"""Organization model."""

import uuid
from datetime import datetime
from typing import List

from sqlalchemy import DateTime, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # relationships (back-populated by child models)
    users: Mapped[List["User"]] = relationship(back_populates="organization")
    projects: Mapped[List["Project"]] = relationship(back_populates="organization")
