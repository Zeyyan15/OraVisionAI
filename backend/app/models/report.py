"""
OraVisionAI — Report Model

Consolidated diagnostic reports capturing patient findings, AI predictions, and generated PDFs.
"""

from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING, Any, Dict, Optional

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.screening import Screening
    from app.models.user import User


class Report(Base):
    """Consolidated clinical report generated for a screening session."""

    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    screening_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("screenings.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    report_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
    )
    generated_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    report_title: Mapped[str] = mapped_column(
        String(200),
        default="Oral Health AI Screening Report",
        nullable=False,
    )
    summary: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    report_data: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
    )
    pdf_storage_path: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("idx_reports_screening_id", "screening_id", unique=True),
        Index("idx_reports_number", "report_number", unique=True),
    )

    # Relationships
    screening: Mapped[Screening] = relationship(
        "Screening",
        back_populates="report",
    )
    generated_by: Mapped[Optional[User]] = relationship(
        "User",
        foreign_keys=[generated_by_id],
    )

