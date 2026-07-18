"""SRS schemas."""
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SRSVersionRead(BaseModel):
    id: uuid.UUID
    project_id: Optional[uuid.UUID]
    session_id: Optional[uuid.UUID]
    version: str
    file_url: Optional[str]
    generated_by: str
    change_summary: Optional[str]
    llm_model: Optional[str]
    prompt_version: Optional[str]
    generation_latency_ms: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


class SRSGenerateRequest(BaseModel):
    session_id: uuid.UUID
    project_id: uuid.UUID
