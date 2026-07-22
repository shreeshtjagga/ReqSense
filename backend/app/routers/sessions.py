"""Sessions router — full Phase 2 CRUD with scoped access checking."""
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser, get_scoped_project, require_roles
from app.models.session import Session
from app.schemas.session import SessionCreate, SessionEnd, SessionRead

from app.models.user import User

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: SessionCreate,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    db: AsyncSession = Depends(get_db),
):
    # Verify the user has access to the project
    await get_scoped_project(project_id=body.project_id, user=current_user, db=db)

    session = Session(
        project_id=body.project_id,
        client_id=body.client_id or (
            current_user.id if current_user.role == "client" else None
        ),
        status="active",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/project/{project_id}", response_model=List[SessionRead])
async def list_sessions_for_project(
    project_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    db: AsyncSession = Depends(get_db),
):
    # Verify access to the project
    await get_scoped_project(project_id=project_id, user=current_user, db=db)

    q = select(Session).where(Session.project_id == project_id)
    if current_user.role == "client":
        q = q.where(Session.client_id == current_user.id)
    result = await db.execute(q)
    return result.scalars().all()


async def _get_scoped_session(
    session_id: uuid.UUID,
    user: User,
    db: AsyncSession,
) -> Session:
    """Helper to fetch a session and verify the user has access to its project."""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )
    # Perform scoping check via the session's project
    await get_scoped_project(project_id=session.project_id, user=user, db=db)
    return session


@router.get("/{session_id}", response_model=SessionRead)
async def get_session(
    session_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    db: AsyncSession = Depends(get_db),
):
    return await _get_scoped_session(session_id, current_user, db)


from app.tasks.srs_tasks import generate_srs_task

@router.patch("/{session_id}/end", response_model=SessionRead)
async def end_session(
    session_id: uuid.UUID,
    body: SessionEnd,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_scoped_session(session_id, current_user, db)
    if session.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Session is not active.",
        )
    session.status = body.status
    session.ended_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(session)
    return session


@router.post("/{session_id}/generate-srs", response_model=SessionRead)
async def trigger_srs_generation(
    session_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer")),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_scoped_session(session_id, current_user, db)
    generate_srs_task.delay(str(session_id))
    return session


