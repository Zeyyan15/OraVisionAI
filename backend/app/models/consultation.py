"""
OraVisionAI — Consultation Model

Live teleconsultation session tracking Stream Video/Audio call metadata and clinical outcomes.
"""

from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING, Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.appointment import Appointment
    from app.models.dentist import Dentist
    from app.models.patient import Patient


class Consultation(Base):
    """Live teleconsultation metadata linked to external Stream call rooms."""

    __tablename__ = "consultations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("appointments.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
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
    stream_call_id: Mapped[str] = mapped_column(
        String(128),
        unique=True,
        nullable=False,
    )
    stream_channel_id: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
    )
    consultation_type: Mapped[str] = mapped_column(
        String(30),
        default="video",
        nullable=False,
    )
    session_status: Mapped[str] = mapped_column(
        String(30),
        default="scheduled",
        nullable=False,
    )
    started_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    ended_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    duration_seconds: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    clinical_summary: Mapped[Optional[str]] = mapped_column(
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
            "consultation_type IN ('video', 'audio', 'chat')",
            name="chk_consultation_type",
        ),
        CheckConstraint(
            "session_status IN ('scheduled', 'active', 'ended', 'failed')",
            name="chk_session_status",
        ),
        Index("idx_consultations_appointment", "appointment_id", unique=True),
        Index("idx_consultations_call_id", "stream_call_id", unique=True),
    )

    # Relationships
    appointment: Mapped[Appointment] = relationship(
        "Appointment",
        back_populates="consultation",
    )
    patient: Mapped[Patient] = relationship(
        "Patient",
        back_populates="consultations",
    )
    dentist: Mapped[Dentist] = relationship(
        "Dentist",
        back_populates="consultations",
    )

