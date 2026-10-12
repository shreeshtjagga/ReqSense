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
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
