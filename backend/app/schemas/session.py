"""Session schemas."""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    project_id: uuid.UUID
    client_id: Optional[uuid.UUID] = None


class SessionRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    client_id: Optional[uuid.UUID]
    status: str
    started_at: datetime
    ended_at: Optional[datetime]
    total_messages: int
    drift_events: int
    contradiction_events: int
    stability_score: float

    model_config = {"from_attributes": True}


class SessionEnd(BaseModel):
    status: str = Field(default="completed", pattern="^(completed|abandoned)$")
