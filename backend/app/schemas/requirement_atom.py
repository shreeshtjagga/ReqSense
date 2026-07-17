"""RequirementAtom schemas — Phase 3 (RDCD layer populates)."""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class RequirementAtomRead(BaseModel):
    id: uuid.UUID
    session_id: Optional[uuid.UUID]
    project_id: Optional[uuid.UUID]
    subject: Optional[str]
    action: Optional[str]
    constraint_text: Optional[str]
    raw_text: str
    embedding_id: Optional[str]
    embedding_model: Optional[str]
    embedding_version: Optional[str]
    status: str
    turn_number: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}
