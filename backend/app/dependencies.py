"""
FastAPI dependencies — authentication and role/org scoped access.

get_current_user:   validates access JWT, returns User ORM object
require_role:       factory that raises 403 if user's role not in allowed set
require_same_org:   raises 403 if user's org_id doesn't match the target resource's org
"""

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
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Validate Bearer JWT and return the User ORM object.
    Raises 401 if the token is missing, invalid, expired, or not an access token.
    Raises 403 if the user account is deactivated.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing.",
        )

    payload = decode_token(credentials.credentials)

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
    """
    Dependency factory — raises 403 if the current user's role is not in roles.

    Usage:
        @router.get("/admin-only")
        async def admin_only(user: User = Depends(require_roles("admin"))):
            ...
    """
    async def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(roles)}. Your role: {user.role}.",
            )
        return user
    return _check


def require_same_org_check(user: User, resource_org_id: Optional[uuid.UUID]) -> None:
    """
    Inline org-scoping check.
    Admins are exempt — they can access any org's resources.
    """
    if user.role == "admin":
        return
    if not resource_org_id or user.organization_id != resource_org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: resource belongs to a different organization.",
        )


# Convenience type aliases for use in route signatures
CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_scoped_project(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Project:
    """
    Loads the project and enforces:
    - project.organization_id == user.organization_id (except for admins)
    - role-based membership: developer must be projects.developer_id or same org+role='developer';
      client must exist in project_clients for this project.
    Raises 404 (not 403) on any mismatch — never leak existence of other orgs' data.
    """
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

    # Client membership check
    if user.role == "client":
        if project.organization_id and user.organization_id == project.organization_id:
            return project
        client_res = await db.execute(
            select(ProjectClient).where(
                ProjectClient.project_id == project_id,
                ProjectClient.client_id == user.id,
            )
        )
        if client_res.scalar_one_or_none():
            return project

        from app.models.session import Session
        sess_res = await db.execute(
            select(Session).where(
                Session.project_id == project_id,
                Session.client_id == user.id,
            )
        )
        if sess_res.scalar_one_or_none():
            return project
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    # Developer check: must be assigned developer OR in same org
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

