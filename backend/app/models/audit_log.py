"""AuditLog — immutable record of every significant action."""

import uuid
from datetime import datetime
from typing import Dict, Optional

from sqlalchemy import DateTime, ForeignKey, JSON, String, func
from sqlalchemy import Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

# Cross-dialect JSON: JSONB on PostgreSQL, plain JSON on SQLite (tests)
_JSON = JSON().with_variant(JSONB(), "postgresql")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(), ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True
    )
    action: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(), nullable=True)
    metadata_: Mapped[Optional[Dict]] = mapped_column(
        "metadata", _JSON, nullable=True
    )  # 'metadata_' avoids shadowing SQLAlchemy's Base.metadata
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    request_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
