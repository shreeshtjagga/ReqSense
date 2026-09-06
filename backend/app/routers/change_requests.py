import json
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_roles, get_scoped_project
from app.models.change_request import ChangeRequest
from app.models.contradiction import Contradiction
from app.models.user import User
from app.schemas.change_request import ChangeRequestCreate, ChangeRequestRead, ChangeRequestReview
from app.services.impact_analyser import ImpactAnalyser
from app.tasks.impact_tasks import run_impact_analysis_task

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/change-requests", tags=["change-requests"])

@router.post("", response_model=ChangeRequestRead, status_code=status.HTTP_201_CREATED)
async def create_change_request(
    body: ChangeRequestCreate,
    project_id: Optional[uuid.UUID] = Query(None, description="Project ID"),
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    db: AsyncSession = Depends(get_db)
):
    pid = body.project_id or project_id
    if not pid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide project_id either in request body or as a query parameter."
        )

    await get_scoped_project(pid, current_user, db)

    cr = ChangeRequest(
        project_id=pid,
        client_id=current_user.id if current_user.role == "client" else None,
        title=body.title,
        description=body.description,
        affected_features=json.dumps(body.affected_features),
        severity=body.severity,
        status="pending",
        version=1
    )
    db.add(cr)
    await db.commit()
    await db.refresh(cr)

    analysis_result: dict = {}
    try:
        analysis_result = await ImpactAnalyser.analyze_impact(
            title=cr.title,
            description=cr.description,
            project_id=cr.project_id,
            db=db,
        )
        cr.severity = analysis_result.get("severity") or cr.severity or "low"
        cr.impact_report = analysis_result.get("impact_report", "")
        cr.affected_features = json.dumps(analysis_result.get("affected_features", []))
        db.add(cr)
        await db.commit()
        await db.refresh(cr)
        logger.info(f"Impact analysis completed inline for change request {cr.id}")
    except Exception as inline_err:
        logger.warning(
            f"Inline impact analysis failed for {cr.id}, queueing Celery fallback: {inline_err}"
        )
        try:
            run_impact_analysis_task.delay(str(cr.id))
        except Exception as celery_err:
            logger.error(f"Celery fallback also failed for {cr.id}: {celery_err}")

    conflict_hits = analysis_result.get("_conflict_hits", [])
    if conflict_hits:
        for hit in conflict_hits:
            db.add(Contradiction(
                session_id=None,
                atom_1_id=hit.get("existing_atom_id"),
                atom_2_id=None,
                confidence=hit.get("confidence"),
                conflict_type=hit.get("conflict_type"),
                aria_message=(
                    hit.get("aria_message")
                    or f"Change request '{cr.title}' may conflict with an existing captured requirement."
                ),
                status="pending",
                source="change_request",
                change_request_id=cr.id,
            ))
        await db.commit()
        logger.info(
            f"{len(conflict_hits)} requirement conflict(s) persisted from change request {cr.id}"
        )

    return cr

@router.get("/project/{project_id}", response_model=List[ChangeRequestRead])
async def list_change_requests(
    project_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
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
    cr = await db.get(ChangeRequest, id)
    if not cr:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Change request not found."
        )

    await get_scoped_project(cr.project_id, current_user, db)

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
