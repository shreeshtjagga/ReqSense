"""EmailLog — records every email send attempt for auditability."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class EmailLog(Base):
    __tablename__ = "email_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    to_email: Mapped[str] = mapped_column(String(255), nullable=False)
    template: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # 'invite', 'password_reset', 'session_summary', 'change_request'
    status: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # 'sent', 'failed'
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
