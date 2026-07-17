"""
RequirementAtom — extracted, structured requirement unit from a session turn.
Linked to a ChromaDB embedding for semantic similarity search.
Phase 3 (RDCD layer) populates these; model added now so FK refs work.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RequirementAtom(Base):
    __tablename__ = "requirement_atoms"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(), ForeignKey("sessions.id", ondelete="SET NULL"), index=True, nullable=True
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(), ForeignKey("projects.id", ondelete="SET NULL"), index=True, nullable=True
    )
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    action: Mapped[str | None] = mapped_column(String(255), nullable=True)
    constraint_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)  # max 5000 chars (app layer)
    embedding_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    embedding_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    embedding_version: Mapped[str | None] = mapped_column(String(30), nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), default="active", nullable=False
    )  # 'active', 'superseded', 'conflicted', 'resolved'
    turn_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
