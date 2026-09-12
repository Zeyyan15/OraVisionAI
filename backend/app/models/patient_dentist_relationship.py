"""
OraVisionAI — Patient-Dentist Relationship Model

Explicit authorization relationship governing patient consent and dentist clinical access.
"""

from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.dentist import Dentist
    from app.models.patient import Patient


class PatientDentistRelationship(Base):
    """Access control association binding patients to authorized treating dentists."""

    __tablename__ = "patient_dentist_relationships"

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
        ForeignKey("dentists.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="active",
        nullable=False,
        index=True,
    )
    established_via: Mapped[str] = mapped_column(
        String(50),
        default="appointment",
        nullable=False,
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
        UniqueConstraint("patient_id", "dentist_id", name="uq_patient_dentist"),
        CheckConstraint(
            "status IN ('active', 'pending_consent', 'revoked', 'archived')",
            name="chk_pdr_status",
        ),
        CheckConstraint(
            "established_via IN ('appointment', 'direct_invite', 'screening_share')",
            name="chk_pdr_established_via",
        ),
        Index("idx_pdr_patient_id", "patient_id"),
        Index("idx_pdr_dentist_id", "dentist_id"),
        Index("idx_pdr_status", "status"),
    )

    # Relationships
    patient: Mapped[Patient] = relationship(
        "Patient",
        back_populates="dentist_relationships",
    )
    dentist: Mapped[Dentist] = relationship(
        "Dentist",
        back_populates="patient_relationships",
    )

