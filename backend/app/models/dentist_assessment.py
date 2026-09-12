"""
OraVisionAI — Dentist Assessment Model

Licensed dentist clinical observations, professional diagnosis, and treatment plans.
Maintained strictly independent from AI predictions.
"""

from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.dentist import Dentist
    from app.models.screening import Screening


class DentistAssessment(Base):
    """Professional clinical diagnosis and recommendations entered by licensed dentists."""

    __tablename__ = "dentist_assessments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    screening_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("screenings.id", ondelete="CASCADE"),
        nullable=False,
    )
    dentist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dentists.id", ondelete="RESTRICT"),
        nullable=False,
    )
    clinical_observations: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    diagnosis_notes: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    treatment_recommendation: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    referral_needed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    referral_specialty: Mapped[Optional[str]] = mapped_column(
        String(150),
        nullable=True,
    )
    is_finalized: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    finalized_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True),
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
        Index("idx_dentist_assessments_screening", "screening_id"),
        Index("idx_dentist_assessments_dentist", "dentist_id"),
    )

    # Relationships
    screening: Mapped[Screening] = relationship(
        "Screening",
        back_populates="dentist_assessments",
    )
    dentist: Mapped[Dentist] = relationship(
        "Dentist",
        back_populates="assessments",
    )

