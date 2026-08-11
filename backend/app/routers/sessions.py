import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser, get_scoped_project, require_roles
from app.models.message import Message
from app.models.session import Session
from app.schemas.message import MessageRead
from app.schemas.session import SessionCreate, SessionEnd, SessionRead
from app.services.session_memory import SessionMemory

from app.models.user import User

router = APIRouter(prefix="/sessions", tags=["sessions"])

@router.post("", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: SessionCreate,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    db: AsyncSession = Depends(get_db),
):
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

    try:
        prev_res = await db.execute(
            select(Message)
            .join(Session, Session.id == Message.session_id)
            .where(Session.project_id == body.project_id, Session.id != session.id)
            .where(Message.sender.in_(["client", "user", "aria"]))
            .where(Message.message_type != "conflict_alert")
            .order_by(Message.created_at.desc())
            .limit(40)
        )
        prev_msgs = list(reversed(prev_res.scalars().all()))
        if prev_msgs:
            marker = {
                "sender": "aria",
                "content": (
                    "[Context carried forward from a prior session — these requirements "
                    "were already captured and do not need to be asked again.]"
                ),
            }
            all_msgs = [marker] + [{"sender": m.sender, "content": m.content} for m in prev_msgs]
            from app.services.session_memory import get_redis_client
            import json as _json
            try:
                r = get_redis_client()
                key = f"session_memory:{session.id}"
                async with r.pipeline(transaction=True) as pipe:
                    for m in all_msgs:
                        pipe.rpush(key, _json.dumps(m))
                    pipe.ltrim(key, -40, -1)
                    pipe.expire(key, 86400)
                    await pipe.execute()
            except Exception as redis_err:
                import logging as _logging
                _logging.getLogger(__name__).warning(
                    "Session pre-seed Redis write failed (non-fatal): %s", redis_err
                )
    except Exception:
        pass

    return session

@router.get("/project/{project_id}", response_model=List[SessionRead])
async def list_sessions_for_project(
    project_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    db: AsyncSession = Depends(get_db),
):
    await get_scoped_project(project_id=project_id, user=current_user, db=db)

    q = select(Session).where(Session.project_id == project_id)
    if current_user.role == "client":
        q = q.where(Session.client_id == current_user.id)
    result = await db.execute(q)
    return result.scalars().all()

@router.get("/project/{project_id}/messages", response_model=List[MessageRead])
async def list_all_project_messages(
    project_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    db: AsyncSession = Depends(get_db),
):
    await get_scoped_project(project_id=project_id, user=current_user, db=db)
    result = await db.execute(
        select(Message)
        .join(Session, Session.id == Message.session_id)
        .where(Session.project_id == project_id)
        .order_by(Message.created_at)
    )
    return result.scalars().all()

async def _get_scoped_session(
    session_id: uuid.UUID,
    user: User,
    db: AsyncSession,
) -> Session:
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found.",
        )
    await get_scoped_project(project_id=session.project_id, user=user, db=db)
    return session

@router.get("/{session_id}", response_model=SessionRead)
async def get_session(
    session_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    db: AsyncSession = Depends(get_db),
):
    return await _get_scoped_session(session_id, current_user, db)

import logging
from app.tasks.srs_tasks import generate_srs_task
from app.services.srs_generator import SRSGenerator

logger = logging.getLogger(__name__)

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

    srs_status = "generated"
    if body.status == "completed":
        try:
            await SRSGenerator.generate_srs(session_id, db)
            logger.info(f"SRS document generated inline for session {session_id}")
        except Exception as e:
            logger.error(f"Inline SRS generation failed for session {session_id}: {e}")
            srs_status = "queued"
            try:
                generate_srs_task.delay(str(session_id))
            except Exception as celery_err:
                logger.error(f"Celery fallback failed for session {session_id}: {celery_err}")
                srs_status = "failed"

    session_dict = SessionRead.model_validate(session).model_dump()
    session_dict["srs_status"] = srs_status
    return session_dict

@router.post("/{session_id}/generate-srs", response_model=SessionRead)
async def trigger_srs_generation(
    session_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_scoped_session(session_id, current_user, db)
    try:
        await SRSGenerator.generate_srs(session_id, db)
    except Exception as e:
        logger.warning(f"Inline SRS generation failed for session {session_id}, queueing Celery task: {e}")
        try:
            generate_srs_task.delay(str(session_id))
        except Exception as celery_err:
            logger.error(f"Celery task dispatch failed: {celery_err}")
    return session
