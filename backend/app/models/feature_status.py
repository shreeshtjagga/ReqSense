"""FeatureStatus — tracks implementation state of each requirement atom."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FeatureStatus(Base):
    __tablename__ = "feature_status"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(), ForeignKey("projects.id", ondelete="SET NULL"), index=True, nullable=True
    )
    atom_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(), ForeignKey("requirement_atoms.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), default="planned", nullable=False
    )  # 'planned', 'in_progress', 'completed'
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)  # optimistic locking
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["Project"] = relationship(foreign_keys=[project_id])
    creator: Mapped["User"] = relationship(foreign_keys=[created_by])
    updater: Mapped["User"] = relationship(foreign_keys=[updated_by])
