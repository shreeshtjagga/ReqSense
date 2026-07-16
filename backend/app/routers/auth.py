"""
Auth router — register, login, refresh, logout, forgot-password, reset-password.

Rate limiting via slowapi:
  - Login:          RATE_LIMIT_LOGIN_PER_MINUTE (default 5/min)
  - Register:       10/min (generous for dev, reasonable for prod)
  - Forgot-password: 3/min (prevent abuse of email sending)
"""

import logging

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    ResetPasswordRequest,
    TokenResponse,
)
from app.services import auth_service

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> RegisterResponse:
    user = await auth_service.register_user(
        db,
        name=body.name,
        email=body.email,
        password=body.password,
        role=body.role,
        organization_id=body.organization_id,
    )
    return RegisterResponse(id=user.id, email=user.email, role=user.role)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login and receive JWT + refresh token",
)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    return await auth_service.login_user(db, email=body.email, password=body.password)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Rotate refresh token, get new access token",
)
async def refresh(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    return await auth_service.refresh_tokens(db, raw_refresh_token=body.refresh_token)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke refresh token (logout)",
)
async def logout(
    body: LogoutRequest,
    db: AsyncSession = Depends(get_db),
) -> None:
    await auth_service.logout_user(db, raw_refresh_token=body.refresh_token)


@router.post(
    "/forgot-password",
    status_code=status.HTTP_200_OK,
    summary="Request a password reset email",
)
async def forgot_password(
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    # Always 200 — don't reveal whether the email exists
    raw_token = await auth_service.initiate_password_reset(db, email=body.email)
    if raw_token:
        # In Phase 1 the email task is stubbed — real Celery email task added in Phase 4
        logger.info("Password reset token generated for %s (email task: TODO Phase 4)", body.email)
    return JSONResponse(
        content={"message": "If this email is registered, a reset link has been sent."}
    )


@router.post(
    "/reset-password",
    status_code=status.HTTP_200_OK,
    summary="Complete password reset with token",
)
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> JSONResponse:
    await auth_service.complete_password_reset(
        db, raw_token=body.token, new_password=body.new_password
    )
    return JSONResponse(content={"message": "Password reset successful."})
