"""
OraVisionAI — Screening Image Model

Records individual oral photographs uploaded for AI classification, detection, and XAI.
"""

from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.ai_prediction import AIPrediction
    from app.models.screening import Screening
    from app.models.xai_result import XAIResult
    from app.models.yolo_detection import YOLODetection


class ScreeningImage(Base):
    """Uploaded image metadata and storage reference."""

    __tablename__ = "screening_images"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    screening_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("screenings.id", ondelete="CASCADE"),
        nullable=False,
    )
    storage_path: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    file_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    file_size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        default="image/jpeg",
        nullable=False,
    )
    image_width: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )
    image_height: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )
    image_sha256: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
    )
    is_primary: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("idx_screening_images_screening_id", "screening_id"),
    )

    # Relationships
    screening: Mapped[Screening] = relationship(
        "Screening",
        back_populates="images",
    )
    ai_predictions: Mapped[List[AIPrediction]] = relationship(
        "AIPrediction",
        back_populates="screening_image",
        cascade="all, delete-orphan",
    )
    yolo_detections: Mapped[List[YOLODetection]] = relationship(
        "YOLODetection",
        back_populates="screening_image",
        cascade="all, delete-orphan",
    )
    xai_results: Mapped[List[XAIResult]] = relationship(
        "XAIResult",
        back_populates="screening_image",
        cascade="all, delete-orphan",
    )

