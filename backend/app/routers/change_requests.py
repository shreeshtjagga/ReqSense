import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_roles, get_scoped_project
from app.models.change_request import ChangeRequest
from app.models.user import User
from app.schemas.change_request import ChangeRequestCreate, ChangeRequestRead, ChangeRequestReview
from app.tasks.impact_tasks import run_impact_analysis_task

router = APIRouter(prefix="/change-requests", tags=["change-requests"])

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

    # Enqueue Celery impact analysis task
    run_impact_analysis_task.delay(str(cr.id))

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
