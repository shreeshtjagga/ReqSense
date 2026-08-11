import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_roles, get_scoped_project
from app.models.requirement_atom import RequirementAtom
from app.models.session import Session
from app.models.user import User
from app.schemas.requirement_atom import RequirementAtomRead

router = APIRouter(prefix="/requirement-atoms", tags=["requirement-atoms"])

@router.get("/project/{project_id}", response_model=List[RequirementAtomRead])
async def list_atoms_for_project(
    project_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    status_filter: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    await get_scoped_project(project_id, current_user, db)

    q = (
        select(RequirementAtom)
        .where(RequirementAtom.project_id == project_id)
        .order_by(RequirementAtom.created_at.desc())
        .limit(min(limit, 500))
        .offset(offset)
    )
    if status_filter:
        q = q.where(RequirementAtom.status == status_filter)

    result = await db.execute(q)
    return result.scalars().all()

@router.get("/session/{session_id}", response_model=List[RequirementAtomRead])
async def list_atoms_for_session(
    session_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin", "developer", "client")),
    limit: int = 200,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    session_res = await db.execute(select(Session).where(Session.id == session_id))
    session = session_res.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    await get_scoped_project(session.project_id, current_user, db)

    result = await db.execute(
        select(RequirementAtom)
        .where(RequirementAtom.session_id == session_id)
        .order_by(RequirementAtom.created_at.desc())
        .limit(min(limit, 500))
        .offset(offset)
    )
    return result.scalars().all()
