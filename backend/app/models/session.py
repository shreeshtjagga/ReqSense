"""
Session model — one requirements-gathering session per (project, client) pair.
Tracks drift/contradiction stats and stability score in real time.
"""

import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(50), default="active", nullable=False
    )  # 'active', 'completed', 'abandoned'
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    total_messages: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    drift_events: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    contradiction_events: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    stability_score: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)

    project: Mapped["Project"] = relationship(back_populates="sessions")
    client: Mapped["User"] = relationship()
    messages: Mapped[List["Message"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
