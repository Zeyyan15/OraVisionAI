"""
OraVisionAI — Patient Medical Profile Model

Stores structured medical, dental, allergy, medication, and lifestyle risk factors.
"""

from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.patient import Patient


class PatientMedicalProfile(Base):
    """Clinical background and lifestyle risk factors for an oral health patient."""

    __tablename__ = "patient_medical_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    medical_history: Mapped[List[Any]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )
    dental_history: Mapped[List[Any]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )
    allergies: Mapped[List[Any]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )
    current_medications: Mapped[List[Any]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )
    smoking_status: Mapped[Optional[str]] = mapped_column(
        String(50),
        default="never",
        nullable=True,
    )
    alcohol_consumption: Mapped[Optional[str]] = mapped_column(
        String(50),
        default="none",
        nullable=True,
    )
    betel_quid_user: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    additional_notes: Mapped[Optional[str]] = mapped_column(
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
        CheckConstraint(
            "smoking_status IN ('never', 'former', 'occasional', 'regular', 'heavy')",
            name="chk_medical_smoking_status",
        ),
        CheckConstraint(
            "alcohol_consumption IN ('none', 'occasional', 'moderate', 'frequent')",
            name="chk_medical_alcohol_consumption",
        ),
        Index("idx_medical_profiles_patient_id", "patient_id", unique=True),
    )

    # Relationships
    patient: Mapped[Patient] = relationship(
        "Patient",
        back_populates="medical_profile",
    )

