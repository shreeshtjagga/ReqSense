"""Message schemas."""
import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)
    sender: Literal["client", "aria", "system"] = "client"
    message_type: Literal[
        "normal", "question", "conflict_alert", "clarification", "summary"
    ] = "normal"


class MessageRead(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    sender: str
    content: str
    message_type: str
    created_at: datetime

    model_config = {"from_attributes": True}
