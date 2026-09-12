"""
OraVisionAI — Patient Profile Model

Extended demographic and clinical profile for users in the patient role.
"""

from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.appointment import Appointment
    from app.models.consultation import Consultation
    from app.models.conversation import Conversation
    from app.models.patient_dentist_relationship import PatientDentistRelationship
    from app.models.patient_medical_profile import PatientMedicalProfile
    from app.models.screening import Screening
    from app.models.user import User


class Patient(Base):
    """Patient profile holding personal, emergency, and contact data."""

    __tablename__ = "patients"

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
    date_of_birth: Mapped[Optional[datetime.date]] = mapped_column(
        Date,
        nullable=True,
    )
    gender: Mapped[Optional[str]] = mapped_column(
        String(30),
        nullable=True,
    )
    emergency_contact_name: Mapped[Optional[str]] = mapped_column(
        String(150),
        nullable=True,
    )
    emergency_contact_phone: Mapped[Optional[str]] = mapped_column(
        String(30),
        nullable=True,
    )
    address: Mapped[Optional[str]] = mapped_column(
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
            "gender IN ('male', 'female', 'other', 'prefer_not_to_say')",
            name="chk_patients_gender",
        ),
        Index("idx_patients_user_id", "user_id", unique=True),
    )

    # Relationships
    user: Mapped[User] = relationship(
        "User",
        back_populates="patient",
    )
    medical_profile: Mapped[Optional[PatientMedicalProfile]] = relationship(
        "PatientMedicalProfile",
        back_populates="patient",
        uselist=False,
        cascade="all, delete-orphan",
    )
    screenings: Mapped[List[Screening]] = relationship(
        "Screening",
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    dentist_relationships: Mapped[List[PatientDentistRelationship]] = relationship(
        "PatientDentistRelationship",
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    appointments: Mapped[List[Appointment]] = relationship(
        "Appointment",
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    consultations: Mapped[List[Consultation]] = relationship(
        "Consultation",
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    conversations: Mapped[List[Conversation]] = relationship(
        "Conversation",
        back_populates="patient",
        cascade="all, delete-orphan",
    )

