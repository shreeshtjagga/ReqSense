"""
Users router — user profile self-service + full admin CRUD.
"""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser, require_roles
from app.models.user import User
from app.schemas.user import UserAdminCreate, UserAdminUpdate, UserResponse
from app.services.auth_service import hash_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserResponse, summary="Get current user profile")
async def get_me(current_user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(current_user)


# ── Platform / Organization Admin CRUD ────────────────────────────────────────

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_user(
    body: UserAdminCreate,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    # Determine organization scoping:
    # If the admin belongs to an org, they can only create users in that same org.
    org_id = current_user.organization_id
    if org_id and body.organization_id and body.organization_id != org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create users for other organizations."
        )
    target_org_id = org_id or body.organization_id

    # Check duplicate email
    res = await db.execute(select(User).where(User.email == body.email))
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered."
        )

    # Validating role
    if body.role not in ("admin", "developer", "client"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role selected."
        )

    user = User(
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
        organization_id=target_org_id,
        is_active=True,
        email_verified=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("", response_model=List[UserResponse])
async def admin_list_users(
    role: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    limit = min(max(limit, 1), 200)

    q = select(User)
    # Scoping filter: platform admin sees all, org admin sees their own org
    if current_user.organization_id:
        q = q.where(User.organization_id == current_user.organization_id)

    if role:
        q = q.where(User.role == role)

    q = q.offset(offset).limit(limit)
    res = await db.execute(q)
    return res.scalars().all()


@router.get("/{user_id}", response_model=UserResponse)
async def admin_get_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Scoping check
    if current_user.organization_id and user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def admin_update_user(
    user_id: uuid.UUID,
    body: UserAdminUpdate,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Scoping check
    if current_user.organization_id and user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "role" and value not in ("admin", "developer", "client"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role."
            )
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_user(
    user_id: uuid.UUID,
    current_user: User = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    # Prevents deleting oneself
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account."
        )

    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Scoping check
    if current_user.organization_id and user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    await db.delete(user)
    await db.commit()
