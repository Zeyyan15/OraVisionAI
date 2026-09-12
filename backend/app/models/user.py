"""
OraVisionAI — User Identity Model

Core account entity representing all platform actors (Patient, Dentist, Admin).
Maps to external Firebase Authentication UID.
"""

from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.audit_log import AuditLog
    from app.models.dentist import Dentist
    from app.models.message import Message
    from app.models.notification import Notification
    from app.models.patient import Patient


class User(Base):
    """Core user account representing any platform actor."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    firebase_uid: Mapped[str] = mapped_column(
        String(128),
        unique=True,
        nullable=False,
        index=True,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
    )
    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    last_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    phone_number: Mapped[Optional[str]] = mapped_column(
        String(30),
        nullable=True,
    )
    avatar_url: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    is_email_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
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

    # Table constraints
    __table_args__ = (
        CheckConstraint(
            "role IN ('patient', 'dentist', 'admin')",
            name="chk_users_role",
        ),
        Index("idx_users_firebase_uid", "firebase_uid", unique=True),
        Index("idx_users_email", "email", unique=True),
        Index("idx_users_role", "role"),
    )

    # Relationships
    patient: Mapped[Optional[Patient]] = relationship(
        "Patient",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    dentist: Mapped[Optional[Dentist]] = relationship(
        "Dentist",
        foreign_keys="[Dentist.user_id]",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    notifications: Mapped[List[Notification]] = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    audit_logs: Mapped[List[AuditLog]] = relationship(
        "AuditLog",
        back_populates="user",
    )
    sent_messages: Mapped[List[Message]] = relationship(
        "Message",
        back_populates="sender",
        cascade="all, delete-orphan",
    )

