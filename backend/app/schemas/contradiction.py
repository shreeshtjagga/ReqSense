import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel

class ContradictionRead(BaseModel):
    id: uuid.UUID
    session_id: Optional[uuid.UUID]
    atom_1_id: Optional[uuid.UUID]
    atom_2_id: Optional[uuid.UUID]
    atom_1_text: Optional[str] = None
    atom_2_text: Optional[str] = None
    similarity_score: Optional[float]
    confidence: Optional[float]
    conflict_type: Optional[str]
    aria_message: Optional[str]
    client_clarification: Optional[str]
    resolution: Optional[str]
    is_false_positive: Optional[bool] = False
    resolved_by: Optional[uuid.UUID]
    status: str
    detected_at: datetime
    resolved_at: Optional[datetime]
    source: str = "chat"
    change_request_id: Optional[uuid.UUID] = None

    model_config = {"from_attributes": True}

class ContradictionResolve(BaseModel):
    action: Literal["resolved", "ignored"]
    resolution: Optional[str] = None
    is_false_positive: Optional[bool] = False
