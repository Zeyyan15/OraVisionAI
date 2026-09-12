"""
OraVisionAI — Dentist Availability Model

Weekly recurring availability slots for appointment scheduling.
"""

from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Integer, SmallInteger, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.dentist import Dentist


class DentistAvailability(Base):
    """Weekly recurring consultation window for a dentist."""

    __tablename__ = "dentist_availabilities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    dentist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("dentists.id", ondelete="CASCADE"),
        nullable=False,
    )
    day_of_week: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
    )
    start_time: Mapped[datetime.time] = mapped_column(
        Time,
        nullable=False,
    )
    end_time: Mapped[datetime.time] = mapped_column(
        Time,
        nullable=False,
    )
    slot_duration_minutes: Mapped[int] = mapped_column(
        Integer,
        default=30,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="chk_day_of_week"),
        CheckConstraint("end_time > start_time", name="chk_time_window"),
        CheckConstraint("slot_duration_minutes > 0", name="chk_slot_duration"),
        Index("idx_availability_dentist", "dentist_id", "day_of_week", "is_active"),
    )

    # Relationships
    dentist: Mapped[Dentist] = relationship(
        "Dentist",
        back_populates="availabilities",
    )

