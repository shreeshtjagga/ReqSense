import uuid
from datetime import datetime, timezone
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
    # In schema: ContradictionResolve has action: Literal["resolved", "ignored"]
    # We map status field to action
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
