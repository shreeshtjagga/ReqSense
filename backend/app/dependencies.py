import uuid
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.project import Project
from app.services.auth_service import decode_token

_bearer = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(_bearer)],
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    raw_token = None
    if credentials:
        raw_token = credentials.credentials
    elif token:
        raw_token = token

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header or token parameter missing.",
        )

    payload = decode_token(raw_token)

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type.",
        )

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated.",
        )
    return user

def require_roles(*roles: str):
    async def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(roles)}. Your role: {user.role}.",
            )
        return user
    return _check

def require_same_org_check(user: User, resource_org_id: Optional[uuid.UUID]) -> None:
    if user.role == "admin":
        return
    if not resource_org_id or user.organization_id != resource_org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: resource belongs to a different organization.",
        )

CurrentUser = Annotated[User, Depends(get_current_user)]

async def get_scoped_project(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Project:
    from app.models.project import ProjectClient

    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    if user.role == "admin":
        return project

    if user.role == "client":
        if project.organization_id and user.organization_id == project.organization_id:
            return project
        client_res = await db.execute(
            select(ProjectClient).where(
                ProjectClient.project_id == project_id,
                ProjectClient.client_id == user.id,
            )
        )
        if client_res.scalars().first():
            return project

        from app.models.session import Session
        sess_res = await db.execute(
            select(Session).where(
                Session.project_id == project_id,
                Session.client_id == user.id,
            )
        )
        if sess_res.scalars().first():
            return project
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    if user.role == "developer":
        if project.developer_id == user.id:
            return project
        if project.organization_id and user.organization_id == project.organization_id:
            return project
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Project not found.",
    )
