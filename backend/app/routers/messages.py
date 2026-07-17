"""Messages router — append-only. Scoped and authenticated access."""
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser, get_scoped_project, require_roles
from app.models.message import Message
from app.models.session import Session
from app.schemas.message import MessageCreate, MessageRead

from app.models.user import User

router = APIRouter(prefix="/sessions/{session_id}/messages", tags=["messages"])


async def _get_scoped_active_session(
    session_id: uuid.UUID,
    user: User,
    db: AsyncSession,
) -> Session:
    """Fetch session, verify access scoping, and ensure session is active."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )
    # Check project-level scope access
    await get_scoped_project(project_id=session.project_id, user=user, db=db)
    
    if session.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot post to a session that is not active.",
        )
    return session


@router.post("", response_model=MessageRead, status_code=status.HTTP_201_CREATED)
async def create_message(
    session_id: uuid.UUID,
    body: MessageCreate,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_scoped_active_session(session_id, current_user, db)
    
    msg = Message(
        session_id=session_id,
        sender=body.sender,
        content=body.content,
        message_type=body.message_type,
    )
    db.add(msg)
    session.total_messages = (session.total_messages or 0) + 1
    await db.commit()
    await db.refresh(msg)
    return msg


@router.get("", response_model=List[MessageRead])
async def list_messages(
    session_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    # Verify access scoping on session first
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )
    await get_scoped_project(project_id=session.project_id, user=current_user, db=db)

    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
        .limit(limit)
        .offset(offset)
    )
    return result.scalars().all()
