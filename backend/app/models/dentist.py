"""
OraVisionAI — Dentist Profile Model

Professional profile, licensing, clinic information, and verification status for dental practitioners.
"""

from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.appointment import Appointment
    from app.models.consultation import Consultation
    from app.models.conversation import Conversation
    from app.models.dentist_assessment import DentistAssessment
    from app.models.dentist_availability import DentistAvailability
    from app.models.dentist_verification import DentistVerification
    from app.models.patient_dentist_relationship import PatientDentistRelationship
    from app.models.user import User


class Dentist(Base):
    """Dentist professional profile and clinical credentials."""

    __tablename__ = "dentists"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    license_number: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
    )
    specialization: Mapped[str] = mapped_column(
        String(150),
        default="General Dentistry",
        nullable=False,
    )
    clinic_name: Mapped[Optional[str]] = mapped_column(
        String(200),
        nullable=True,
    )
    clinic_address: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    years_of_experience: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    bio: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    verification_status: Mapped[str] = mapped_column(
        String(30),
        default="pending",
        nullable=False,
        index=True,
    )
    verified_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    verified_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    rejection_reason: Mapped[Optional[str]] = mapped_column(
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
            "verification_status IN ('pending', 'approved', 'rejected', 'suspended')",
            name="chk_dentists_verification_status",
        ),
        CheckConstraint(
            "years_of_experience >= 0",
            name="chk_dentists_experience",
        ),
        Index("idx_dentists_user_id", "user_id", unique=True),
        Index("idx_dentists_license", "license_number", unique=True),
        Index("idx_dentists_verification_status", "verification_status"),
    )

    # Relationships
    user: Mapped[User] = relationship(
        "User",
        foreign_keys=[user_id],
        back_populates="dentist",
    )
    verified_by: Mapped[Optional[User]] = relationship(
        "User",
        foreign_keys=[verified_by_id],
    )
    verifications: Mapped[List[DentistVerification]] = relationship(
        "DentistVerification",
        back_populates="dentist",
        cascade="all, delete-orphan",
    )
    patient_relationships: Mapped[List[PatientDentistRelationship]] = relationship(
        "PatientDentistRelationship",
        back_populates="dentist",
        cascade="all, delete-orphan",
    )
    availabilities: Mapped[List[DentistAvailability]] = relationship(
        "DentistAvailability",
        back_populates="dentist",
        cascade="all, delete-orphan",
    )
    assessments: Mapped[List[DentistAssessment]] = relationship(
        "DentistAssessment",
        back_populates="dentist",
    )
    appointments: Mapped[List[Appointment]] = relationship(
        "Appointment",
        back_populates="dentist",
    )
    consultations: Mapped[List[Consultation]] = relationship(
        "Consultation",
        back_populates="dentist",
    )
    conversations: Mapped[List[Conversation]] = relationship(
        "Conversation",
        back_populates="dentist",
        cascade="all, delete-orphan",
    )

