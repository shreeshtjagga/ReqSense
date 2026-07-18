import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_roles, get_scoped_project
from app.models.contradiction import Contradiction
from app.models.session import Session
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.contradiction import ContradictionRead, ContradictionResolve

router = APIRouter(prefix="/contradictions", tags=["contradictions"])


@router.get("/project/{project_id}", response_model=List[ContradictionRead])
async def list_contradictions_for_project(
    project_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """
    List all contradictions detected across all sessions of a project.
    Used by ProjectDetail tabs and the Analytics pie chart.
    """
    await get_scoped_project(project_id, current_user, db)

    # Fetch session IDs for this project
    session_ids_res = await db.execute(
        select(Session.id).where(Session.project_id == project_id)
    )
    session_ids = [row[0] for row in session_ids_res.all()]

    if not session_ids:
        return []

    result = await db.execute(
        select(Contradiction)
        .where(Contradiction.session_id.in_(session_ids))
        .order_by(Contradiction.detected_at.desc())
        .limit(min(limit, 200))
        .offset(offset)
    )
    return result.scalars().all()


@router.get("/session/{session_id}", response_model=List[ContradictionRead])
async def list_contradictions_for_session(
    session_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """
    List all contradictions detected within a single session.
    """
    session_res = await db.execute(select(Session).where(Session.id == session_id))
    session = session_res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    await get_scoped_project(session.project_id, current_user, db)

    result = await db.execute(
        select(Contradiction)
        .where(Contradiction.session_id == session_id)
        .order_by(Contradiction.detected_at.desc())
        .limit(min(limit, 200))
        .offset(offset)
    )
    return result.scalars().all()


@router.patch("/{id}", response_model=ContradictionRead)
async def resolve_contradiction(
    id: uuid.UUID,
    body: ContradictionResolve,
    current_user: User = Depends(require_roles("admin", "developer")),
    db: AsyncSession = Depends(get_db)
):
    """
    Developer override: resolve or ignore a detected contradiction.
    """
    c = await db.get(Contradiction, id)
    if not c:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contradiction not found."
        )

    # Scoping check: load session, then verify project
    session_res = await db.execute(select(Session).where(Session.id == c.session_id))
    session = session_res.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session for contradiction not found."
        )
    await get_scoped_project(session.project_id, current_user, db)

    # Perform action update
    c.status = body.action
    c.resolution = body.resolution or f"Marked as {body.action} by developer."
    c.resolved_by = current_user.id
    c.resolved_at = datetime.now(timezone.utc)

    # Write audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="resolve_contradiction",
        entity_type="contradiction",
        entity_id=c.id,
        metadata={"action_taken": body.action, "resolution_note": body.resolution}
    )
    db.add(audit)
    db.add(c)
    await db.commit()
    await db.refresh(c)

    return c
