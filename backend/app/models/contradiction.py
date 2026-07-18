"""
Contradiction model — 2-way conflicts between RequirementAtoms.
Developer can override (resolve/ignore/merge) via the contradictions router.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Contradiction(Base):
    __tablename__ = "contradictions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(), ForeignKey("sessions.id", ondelete="SET NULL"), index=True, nullable=True
    )
    atom_1_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(), ForeignKey("requirement_atoms.id", ondelete="SET NULL"), nullable=True
    )
    atom_2_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(), ForeignKey("requirement_atoms.id", ondelete="SET NULL"), nullable=True
    )
    similarity_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0.0–1.0
    conflict_type: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True
    )  # 'scope_creep', 'user_shift', 'priority_flip', 'direct_contradiction'
    aria_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    client_clarification: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolution: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolved_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(50), default="pending", nullable=False
    )  # 'pending', 'resolved', 'unresolved', 'ignored'
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    atom_1: Mapped["RequirementAtom"] = relationship(foreign_keys=[atom_1_id])
    atom_2: Mapped["RequirementAtom"] = relationship(foreign_keys=[atom_2_id])
    resolver: Mapped["User"] = relationship(foreign_keys=[resolved_by])
