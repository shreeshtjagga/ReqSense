"""SRSVersion — each generated SRS document stored in S3/R2."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy import Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SRSVersion(Base):
    __tablename__ = "srs_versions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(), ForeignKey("projects.id", ondelete="SET NULL"), index=True, nullable=True
    )
    session_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(), ForeignKey("sessions.id", ondelete="SET NULL"), index=True, nullable=True
    )
    version: Mapped[str] = mapped_column(String(20), nullable=False)  # '1.0', '1.1', '2.0'
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)  # S3/R2 URL
    generated_by: Mapped[str] = mapped_column(
        String(50), default="system", nullable=False
    )
    change_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    llm_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    generation_latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    project: Mapped["Project"] = relationship()
