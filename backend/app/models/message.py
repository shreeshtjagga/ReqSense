"""
Message model — append-only conversation log.
No soft delete, no editing. Composite index (session_id, created_at) added
in migration 002 for the primary query pattern.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_session_created", "session_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    sender: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # 'client', 'aria', 'system'
    content: Mapped[str] = mapped_column(Text, nullable=False)  # max 4000 chars at app layer
    message_type: Mapped[str] = mapped_column(
        String(50), default="normal", nullable=False
    )  # 'normal', 'question', 'conflict_alert', 'clarification', 'summary'
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    session: Mapped["Session"] = relationship(back_populates="messages")
