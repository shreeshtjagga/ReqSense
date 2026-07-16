"""User schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: EmailStr
    role: str
    is_active: bool
    email_verified: bool
    organization_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}
