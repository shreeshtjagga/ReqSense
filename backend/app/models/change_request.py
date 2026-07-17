"""ChangeRequest — client-initiated requests to change an existing requirement."""

import uuid
from datetime import datetime

from sqlalchemy import ARRAY, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy import Uuid
from sqlalchemy.dialects.postgresql import ARRAY as PG_ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ChangeRequest(Base):
    __tablename__ = "change_requests"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(), ForeignKey("projects.id", ondelete="SET NULL"), index=True, nullable=True
    )
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)  # max 10000 chars (app layer)
    # affected_features stored as JSON list — TEXT[] on PG, JSON on SQLite
    affected_features: Mapped[str | None] = mapped_column(Text, nullable=True)
    impact_report: Mapped[str | None] = mapped_column(Text, nullable=True)
    severity: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # 'low', 'medium', 'high'
    status: Mapped[str] = mapped_column(
        String(50), default="pending", nullable=False
    )  # 'pending', 'approved', 'rejected'
    developer_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)  # optimistic locking
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped["Project"] = relationship(foreign_keys=[project_id])
    client: Mapped["User"] = relationship(foreign_keys=[client_id])
