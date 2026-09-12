"""
OraVisionAI — AI Model Registry Model

Tracks versioned AI model artifacts (EfficientNetB0 classifiers, YOLO detectors) for historical reproducibility.
"""

from __future__ import annotations

import datetime
import uuid
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, Index, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.ai_prediction import AIPrediction
    from app.models.yolo_detection import YOLODetection


class AIModel(Base):
    """Model version registry enabling multi-model inference and historical tracking."""

    __tablename__ = "ai_models"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    model_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    version: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    architecture: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    weights_path: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    input_shape: Mapped[str] = mapped_column(
        String(50),
        default="224x224x3",
        nullable=False,
    )
    class_labels: Mapped[List[Any]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )
    target_layers: Mapped[Optional[List[Any]]] = mapped_column(
        JSONB,
        default=list,
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
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
        UniqueConstraint("name", "version", name="uq_model_name_version"),
        CheckConstraint(
            "model_type IN ('classifier', 'detector', 'multimodal', 'risk_engine')",
            name="chk_models_type",
        ),
        Index("idx_ai_models_active", "model_type", "is_active"),
    )

    # Relationships (ON DELETE RESTRICT prevents deleting active production models)
    predictions: Mapped[List[AIPrediction]] = relationship(
        "AIPrediction",
        back_populates="ai_model",
        passive_deletes="all",
    )
    detections: Mapped[List[YOLODetection]] = relationship(
        "YOLODetection",
        back_populates="ai_model",
        passive_deletes="all",
    )

