"""
OraVisionAI — Appointment Model

Patient-dentist consultation booking requests, schedules, and lifecycle status.
"""

from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.consultation import Consultation
    from app.models.dentist import Dentist
    from app.models.patient import Patient
    from app.models.screening import Screening
    from app.models.user import User


class Appointment(Base):
    """Consultation booking request and schedule record."""

    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
    )
    dentist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dentists.id", ondelete="RESTRICT"),
        nullable=False,
    )
    screening_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("screenings.id", ondelete="SET NULL"),
        nullable=True,
    )
    scheduled_start: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    scheduled_end: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    appointment_type: Mapped[str] = mapped_column(
        String(50),
        default="video_teleconsultation",
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="requested",
        nullable=False,
        index=True,
    )
    cancellation_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    cancelled_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    patient_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    dentist_notes: Mapped[Optional[str]] = mapped_column(
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
            "appointment_type IN ('video_teleconsultation', 'audio_teleconsultation', 'in_person_consultation', 'follow_up')",
            name="chk_appt_type",
        ),
        CheckConstraint(
            "status IN ('requested', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'no_show')",
            name="chk_appt_status",
        ),
        CheckConstraint("scheduled_end > scheduled_start", name="chk_appt_time"),
        Index("idx_appts_patient", "patient_id", "scheduled_start"),
        Index("idx_appts_dentist", "dentist_id", "scheduled_start"),
        Index("idx_appts_status", "status"),
    )

    # Relationships
    patient: Mapped[Patient] = relationship(
        "Patient",
        back_populates="appointments",
    )
    dentist: Mapped[Dentist] = relationship(
        "Dentist",
        back_populates="appointments",
    )
    screening: Mapped[Optional[Screening]] = relationship(
        "Screening",
        back_populates="appointments",
    )
    cancelled_by: Mapped[Optional[User]] = relationship(
        "User",
        foreign_keys=[cancelled_by_id],
    )
    consultation: Mapped[Optional[Consultation]] = relationship(
        "Consultation",
        back_populates="appointment",
        uselist=False,
        cascade="all, delete-orphan",
    )

