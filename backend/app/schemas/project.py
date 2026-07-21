"""Project schemas."""
import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    domain: Optional[Literal["mobile_app", "web_app", "software", "api"]] = None
    organization_id: Optional[uuid.UUID] = None
    developer_id: Optional[uuid.UUID] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    domain: Optional[Literal["mobile_app", "web_app", "software", "api"]] = None
    status: Optional[Literal["active", "completed", "on_hold", "archived"]] = None
    developer_id: Optional[uuid.UUID] = None
    chroma_similarity_threshold: Optional[float] = Field(None, ge=0.05, le=1.0)


class ProjectRead(BaseModel):
    id: uuid.UUID
    organization_id: Optional[uuid.UUID]
    name: str
    description: Optional[str]
    domain: Optional[str]
    developer_id: Optional[uuid.UUID]
    status: str
    chroma_similarity_threshold: float = 0.3
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectClientAdd(BaseModel):
    client_id: uuid.UUID


class ProjectClientRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    client_id: uuid.UUID
    invited_at: datetime

    model_config = {"from_attributes": True}


class ProjectInviteCreate(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    role: Literal["client", "developer"] = "client"


class ProjectInviteRead(BaseModel):
    id: uuid.UUID
    email: str
    project_id: uuid.UUID
    organization_id: uuid.UUID
    role: str
    expires_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}
