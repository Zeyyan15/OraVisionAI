"""
OraVisionAI — Screening Model

Screening session header tracking oral health analysis lifecycle and soft deletion.
"""

from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.ai_prediction import AIPrediction
    from app.models.appointment import Appointment
    from app.models.dentist_assessment import DentistAssessment
    from app.models.patient import Patient
    from app.models.report import Report
    from app.models.risk_assessment import RiskAssessment
    from app.models.screening_image import ScreeningImage
    from app.models.user import User
    from app.models.yolo_detection import YOLODetection


class Screening(Base):
    """Screening session header for oral health AI diagnostics."""

    __tablename__ = "screenings"

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
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="pending",
        nullable=False,
        index=True,
    )
    clinical_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    is_deleted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    deleted_at: Mapped[Optional[datetime.datetime]] = mapped_column(
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
        CheckConstraint(
            "status IN ('pending', 'uploading', 'processing', 'completed', 'failed')",
            name="chk_screenings_status",
        ),
        Index("idx_screenings_patient_id", "patient_id"),
        Index("idx_screenings_status", "status"),
        Index("idx_screenings_active", "patient_id", "is_deleted", "created_at"),
    )

    # Relationships
    patient: Mapped[Patient] = relationship(
        "Patient",
        back_populates="screenings",
    )
    created_by: Mapped[User] = relationship(
        "User",
        foreign_keys=[created_by_id],
    )
    images: Mapped[List[ScreeningImage]] = relationship(
        "ScreeningImage",
        back_populates="screening",
        cascade="all, delete-orphan",
    )
    ai_predictions: Mapped[List[AIPrediction]] = relationship(
        "AIPrediction",
        back_populates="screening",
        cascade="all, delete-orphan",
    )
    yolo_detections: Mapped[List[YOLODetection]] = relationship(
        "YOLODetection",
        back_populates="screening",
        cascade="all, delete-orphan",
    )
    risk_assessment: Mapped[Optional[RiskAssessment]] = relationship(
        "RiskAssessment",
        back_populates="screening",
        uselist=False,
        cascade="all, delete-orphan",
    )
    report: Mapped[Optional[Report]] = relationship(
        "Report",
        back_populates="screening",
        uselist=False,
        cascade="all, delete-orphan",
    )
    dentist_assessments: Mapped[List[DentistAssessment]] = relationship(
        "DentistAssessment",
        back_populates="screening",
        cascade="all, delete-orphan",
    )
    appointments: Mapped[List[Appointment]] = relationship(
        "Appointment",
        back_populates="screening",
    )

