"""ChangeRequest schemas."""
import uuid
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class ChangeRequestCreate(BaseModel):
    project_id: Optional[uuid.UUID] = None
    title: str = Field(..., min_length=1, max_length=255)
    description: str = Field(..., min_length=1, max_length=10000)
    affected_features: List[str] = Field(default_factory=list)
    severity: Optional[Literal["low", "medium", "high"]] = None



class ChangeRequestReview(BaseModel):
    status: Literal["approved", "rejected"]
    developer_note: Optional[str] = None
    version: int  # optimistic lock


class ChangeRequestRead(BaseModel):
    id: uuid.UUID
    project_id: Optional[uuid.UUID]
    client_id: Optional[uuid.UUID]
    title: str
    description: str
    affected_features: Optional[str]  # JSON-encoded list
    impact_report: Optional[str]
    severity: Optional[str]
    status: str
    developer_note: Optional[str]
    version: int
    created_at: datetime
    reviewed_at: Optional[datetime]

    model_config = {"from_attributes": True}
