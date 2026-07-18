"""
Auth schemas — Pydantic v2 models for all auth-related request/response bodies.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional


# ── Registration ──────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: str = Field(..., pattern="^(client|developer|admin)$")
    organization_id: Optional[uuid.UUID] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit.")
        return v


class RegisterResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    message: str = "Registration successful."


# ── Login ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # access token lifetime in seconds


# ── Refresh ───────────────────────────────────────────────────────────────────

class RefreshRequest(BaseModel):
    refresh_token: str


# ── Logout ────────────────────────────────────────────────────────────────────

class LogoutRequest(BaseModel):
    refresh_token: str


# ── Forgot / Reset password ───────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter.")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit.")
        return v


# ── JWT payload ───────────────────────────────────────────────────────────────

class TokenPayload(BaseModel):
    sub: str          # user UUID as string
    role: str
    org: Optional[str]   # organization UUID as string, nullable
    exp: datetime
    type: str         # "access" or "stream"


class VerifyEmailRequest(BaseModel):
    token: str

