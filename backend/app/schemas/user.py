"""User schemas."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class UserResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: EmailStr
    role: str
    is_active: bool
    email_verified: bool
    organization_id: Optional[uuid.UUID]
    created_at: datetime

    model_config = {"from_attributes": True}


class UserAdminCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str  # 'client', 'developer', 'admin'
    organization_id: Optional[uuid.UUID] = None


class UserAdminUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserLookupResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: EmailStr
    role: str

    model_config = {"from_attributes": True}

