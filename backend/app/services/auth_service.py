"""
Auth service — all authentication business logic.

Password hashing:  argon2-cffi  (NOT passlib/bcrypt)
JWT:               PyJWT        (NOT python-jose)
Refresh tokens:    stored as SHA-256 hash in DB; never plaintext
Account lockout:   5 failed attempts → 15 minute lockout
email_verified:    tracked, not enforced as a login gate in v1
                   (per master spec note — gating deferred to a later phase)
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.password_reset_token import PasswordResetToken
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.schemas.auth import TokenResponse

settings = get_settings()

# argon2-cffi hasher — defaults are deliberately conservative
_ph = PasswordHasher()

# Lockout policy
_MAX_FAILED_ATTEMPTS = 5
_LOCKOUT_MINUTES = 15


# ── Password utilities ────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return _ph.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, plain)
    except (VerificationError, VerifyMismatchError):
        return False


# ── Token utilities ───────────────────────────────────────────────────────────

def _hash_token(raw: str) -> str:
    """SHA-256 hash a token before storing. Never store raw refresh tokens."""
    return hashlib.sha256(raw.encode()).hexdigest()


def create_access_token(user: User) -> tuple[str, int]:
    """Return (encoded_jwt, expires_in_seconds)."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "org": str(user.organization_id) if user.organization_id else None,
        "type": "access",
        "exp": expire,
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token, settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


def create_stream_token(user: User) -> str:
    """Short-lived one-time token for SSE stream authentication."""
    expire = datetime.now(timezone.utc) + timedelta(
        seconds=settings.STREAM_TOKEN_EXPIRE_SECONDS
    )
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "org": str(user.organization_id) if user.organization_id else None,
        "type": "stream",
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and verify a JWT. Raises HTTPException on failure."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token.",
        )


# ── Auth flows ────────────────────────────────────────────────────────────────

async def register_user(
    db: AsyncSession,
    *,
    name: str,
    email: str,
    password: str,
    role: str,
    organization_id: uuid.UUID | None,
) -> User:
    # Duplicate email check
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )

    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
        role=role,
        organization_id=organization_id,
    )
    db.add(user)
    await db.flush()  # get user.id without committing
    return user


async def login_user(
    db: AsyncSession,
    *,
    email: str,
    password: str,
) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    # Unified "invalid credentials" message — don't reveal whether email exists
    _invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password.",
    )

    if not user:
        raise _invalid

    # Lockout check
    now = datetime.now(timezone.utc)
    if user.locked_until and user.locked_until > now:
        remaining = int((user.locked_until - now).total_seconds() / 60) + 1
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Account is locked. Try again in {remaining} minute(s).",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated.",
        )

    # NOTE: email_verified is NOT checked here in v1 (per master spec —
    # gating deferred; the field is tracked and the email flow is wired,
    # but we don't block login on it yet).

    if not verify_password(password, user.password_hash or ""):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= _MAX_FAILED_ATTEMPTS:
            user.locked_until = now + timedelta(minutes=_LOCKOUT_MINUTES)
        await db.flush()
        raise _invalid

    # Successful login — reset counter
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.flush()

    # Issue tokens
    access_token, expires_in = create_access_token(user)
    raw_refresh = secrets.token_urlsafe(48)
    refresh_record = RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(raw_refresh),
        expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(refresh_record)
    await db.flush()

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        token_type="bearer",
        expires_in=expires_in,
    )


async def refresh_tokens(
    db: AsyncSession,
    *,
    raw_refresh_token: str,
) -> TokenResponse:
    token_hash = _hash_token(raw_refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    record = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if not record or record.revoked or record.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is invalid or expired.",
        )

    # Rotate — revoke old, issue new
    record.revoked = True
    await db.flush()

    user_result = await db.execute(select(User).where(User.id == record.user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated.",
        )

    access_token, expires_in = create_access_token(user)
    raw_new = secrets.token_urlsafe(48)
    new_record = RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(raw_new),
        expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(new_record)
    await db.flush()

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_new,
        token_type="bearer",
        expires_in=expires_in,
    )


async def logout_user(
    db: AsyncSession,
    *,
    raw_refresh_token: str,
) -> None:
    token_hash = _hash_token(raw_refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    record = result.scalar_one_or_none()
    if record and not record.revoked:
        record.revoked = True
        await db.flush()


async def initiate_password_reset(
    db: AsyncSession,
    *,
    email: str,
) -> str | None:
    """
    Returns the raw reset token if the email exists, None if it doesn't.
    The caller always responds with HTTP 200 to avoid user enumeration.
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        return None

    raw_token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    reset_record = PasswordResetToken(
        user_id=user.id,
        token=raw_token,
        expires_at=now + timedelta(hours=1),
    )
    db.add(reset_record)
    await db.flush()
    return raw_token


async def complete_password_reset(
    db: AsyncSession,
    *,
    raw_token: str,
    new_password: str,
) -> None:
    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token == raw_token)
    )
    record = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if not record or record.used or record.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token is invalid or has expired.",
        )

    record.used = True
    user_result = await db.execute(select(User).where(User.id == record.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token is invalid.",
        )

    user.password_hash = hash_password(new_password)
    await db.flush()
