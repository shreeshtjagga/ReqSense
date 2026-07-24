import json
import logging
import uuid
import asyncio
import functools
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_roles, get_scoped_project
from app.models.change_request import ChangeRequest
from app.models.user import User
from app.schemas.change_request import ChangeRequestCreate, ChangeRequestRead, ChangeRequestReview
from app.tasks.impact_tasks import run_impact_analysis_task
from app.services.impact_analyser import ImpactAnalyser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/change-requests", tags=["change-requests"])


def _run_impact_sync(title: str, description: str, project_id: uuid.UUID) -> Optional[Dict[str, Any]]:
    """
    Synchronous wrapper that calls ImpactAnalyser with a temporary sync DB session.
    Designed to run inside a thread executor so it never blocks the async event loop.
    Returns the analysis dict or None on any error.
    """
    try:
        import app.database as _db_module
        from sqlalchemy.orm import Session

        # Build a fresh synchronous session
        sync_engine = _db_module.engine.sync_engine
        with Session(sync_engine) as sync_db:
            from sqlalchemy import select as sync_select
            from app.models.feature_status import FeatureStatus
            from app.config import get_settings
            settings = get_settings()

            features = sync_db.execute(
                sync_select(FeatureStatus).where(FeatureStatus.project_id == project_id)
            ).scalars().all()

            if not features:
                return {
                    "affected_features": [],
                    "severity": "low",
                    "impact_report": "No features tracked for this project yet.",
                }

            features_list = "\n".join([
                f"- Title: {f.title}\n  Description: {f.description or 'No description'}"
                for f in features
            ])

            from app.utils.prompts import IMPACT_ANALYSIS_PROMPT
            from app.services.aria_agent import get_groq_client

            prompt = IMPACT_ANALYSIS_PROMPT.format(
                title=title,
                description=description,
                features_list=features_list,
            )

            client = get_groq_client()
            resp = client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                timeout=settings.GROQ_TIMEOUT_SECONDS,
            )
            raw = resp.choices[0].message.content.strip()
            if raw.startswith("```"):
                lines = raw.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines[-1].strip() == "```":
                    lines = lines[:-1]
                raw = "\n".join(lines).strip()
            return json.loads(raw)
    except Exception as exc:
        logger.warning("_run_impact_sync failed (non-fatal): %s", exc)
        return None


@router.post("", response_model=ChangeRequestRead, status_code=status.HTTP_201_CREATED)
async def create_change_request(
    body: ChangeRequestCreate,
    project_id: Optional[uuid.UUID] = Query(None, description="Project ID"),
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new change request and enqueue impact analysis background task.
    """
    pid = body.project_id or project_id
    if not pid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide project_id either in request body or as a query parameter."
        )

    # Scoped access check
    await get_scoped_project(pid, current_user, db)

    # Serialize list to JSON string
    serialized_features = json.dumps(body.affected_features)

    cr = ChangeRequest(
        project_id=pid,
        client_id=current_user.id if current_user.role == "client" else None,
        title=body.title,
        description=body.description,
        affected_features=serialized_features,
        severity=body.severity,
        status="pending",
        version=1
    )
    db.add(cr)
    await db.commit()
    await db.refresh(cr)

    # Perform impact analysis in a background thread so it never blocks
    # the async event loop. Any failure here is non-fatal — the CR was
    # already persisted above.
    try:
        import asyncio
        import functools
        loop = asyncio.get_event_loop()
        analysis_result = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                functools.partial(
                    _run_impact_sync,
                    cr.title,
                    cr.description,
                    cr.project_id,
                )
            ),
            timeout=20.0,
        )
        if analysis_result:
            cr.severity = analysis_result.get("severity", cr.severity or "medium")
            cr.impact_report = analysis_result.get("impact_report", "Impact analysis completed.")
            if analysis_result.get("affected_features"):
                cr.affected_features = json.dumps(analysis_result.get("affected_features"))
            db.add(cr)
            await db.commit()
            await db.refresh(cr)
    except Exception as e:
        logger.warning(f"Impact analysis skipped for change request {cr.id}: {e}")

    # Enqueue background Celery task as fallback (best-effort — never crashes)
    try:
        run_impact_analysis_task.delay(str(cr.id))
    except Exception as e:
        logger.debug(f"Celery dispatch skipped/failed (non-fatal): {e}")

    return cr


@router.get("/project/{project_id}", response_model=List[ChangeRequestRead])
async def list_change_requests(
    project_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """
    List all change requests for a project.
    """
    await get_scoped_project(project_id, current_user, db)

    q = (
        select(ChangeRequest)
        .where(ChangeRequest.project_id == project_id)
        .order_by(ChangeRequest.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{id}", response_model=ChangeRequestRead)
async def get_change_request(
    id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    db: AsyncSession = Depends(get_db)
):
    """
    Get change request details.
    """
    cr = await db.get(ChangeRequest, id)
    if not cr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Change request not found."
        )

    await get_scoped_project(cr.project_id, current_user, db)
    return cr


@router.patch("/{id}", response_model=ChangeRequestRead)
async def review_change_request(
    id: uuid.UUID,
    body: ChangeRequestReview,
    current_user: User = Depends(require_roles("admin", "developer")),
    db: AsyncSession = Depends(get_db)
):
    """
    Review (approve/reject) a change request with optimistic locking.
    """
    cr = await db.get(ChangeRequest, id)
    if not cr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Change request not found."
        )

    await get_scoped_project(cr.project_id, current_user, db)

    # Optimistic locking check
    if cr.version != body.version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="STALE_VERSION"
        )

    cr.status = body.status
    cr.developer_note = body.developer_note
    cr.reviewed_at = datetime.now(timezone.utc)
    cr.version += 1

    db.add(cr)
    await db.commit()
    await db.refresh(cr)
    return cr
