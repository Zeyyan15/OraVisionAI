"""
OraVisionAI — Conversation Model

Direct messaging channels between patients and authorized dentists mapped to Stream Chat.
"""

from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.dentist import Dentist
    from app.models.message import Message
    from app.models.patient import Patient


class Conversation(Base):
    """Messaging thread between a patient and a licensed dentist."""

    __tablename__ = "conversations"

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
    stream_channel_id: Mapped[str] = mapped_column(
        String(128),
        unique=True,
        nullable=False,
    )
    conversation_type: Mapped[str] = mapped_column(
        String(30),
        default="direct",
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    last_message_at: Mapped[Optional[datetime.datetime]] = mapped_column(
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
        UniqueConstraint("patient_id", "dentist_id", "conversation_type", name="uq_patient_dentist_conv"),
        CheckConstraint(
            "conversation_type IN ('direct', 'consultation_chat')",
            name="chk_conversation_type",
        ),
        Index("idx_conv_stream_channel", "stream_channel_id", unique=True),
        Index("idx_conv_patient", "patient_id"),
        Index("idx_conv_dentist", "dentist_id"),
    )

    # Relationships
    patient: Mapped[Patient] = relationship(
        "Patient",
        back_populates="conversations",
    )
    dentist: Mapped[Dentist] = relationship(
        "Dentist",
        back_populates="conversations",
    )
    messages: Mapped[List[Message]] = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )

