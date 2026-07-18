"""Contradiction schemas."""
import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel


class ContradictionRead(BaseModel):
    id: uuid.UUID
    session_id: Optional[uuid.UUID]
    atom_1_id: Optional[uuid.UUID]
    atom_2_id: Optional[uuid.UUID]
    similarity_score: Optional[float]
    confidence: Optional[float]
    conflict_type: Optional[str]
    aria_message: Optional[str]
    client_clarification: Optional[str]
    resolution: Optional[str]
    resolved_by: Optional[uuid.UUID]
    status: str
    detected_at: datetime
    resolved_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ContradictionResolve(BaseModel):
    """Developer override — resolve, ignore, or merge a contradiction."""
    action: Literal["resolved", "ignored"]
    resolution: Optional[str] = None
