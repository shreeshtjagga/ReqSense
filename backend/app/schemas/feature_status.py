"""FeatureStatus schemas."""
import uuid
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class FeatureStatusCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    atom_id: Optional[uuid.UUID] = None


class FeatureStatusUpdate(BaseModel):
    status: Optional[Literal["planned", "in_progress", "completed"]] = None
    description: Optional[str] = None
    version: int  # must match current version (optimistic lock)


class FeatureStatusRead(BaseModel):
    id: uuid.UUID
    project_id: Optional[uuid.UUID]
    atom_id: Optional[uuid.UUID]
    title: str
    description: Optional[str]
    status: str
    version: int
    created_by: Optional[uuid.UUID]
    updated_by: Optional[uuid.UUID]
    updated_at: datetime

    model_config = {"from_attributes": True}
