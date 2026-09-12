"""
OraVisionAI — AI Prediction Model

Stores top-level 7-class classification inference results and latency metrics.
"""

from __future__ import annotations

import datetime
import decimal
import uuid
from typing import TYPE_CHECKING, Any, Dict, List, Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.ai_model import AIModel
    from app.models.prediction_probability import PredictionProbability
    from app.models.risk_assessment import RiskAssessment
    from app.models.screening import Screening
    from app.models.screening_image import ScreeningImage
    from app.models.xai_result import XAIResult


class AIPrediction(Base):
    """Inference execution result for an oral screening image."""

    __tablename__ = "ai_predictions"

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
    screening_image_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("screening_images.id", ondelete="CASCADE"),
        nullable=False,
    )
    ai_model_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_models.id", ondelete="RESTRICT"),
        nullable=False,
    )
    predicted_class: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    confidence: Mapped[decimal.Decimal] = mapped_column(
        Numeric(5, 4),
        nullable=False,
    )
    inference_duration_ms: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        default="completed",
        nullable=False,
    )
    raw_output: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "confidence >= 0.0 AND confidence <= 1.0",
            name="chk_prediction_confidence",
        ),
        CheckConstraint(
            "status IN ('processing', 'completed', 'failed')",
            name="chk_prediction_status",
        ),
        Index("idx_predictions_screening_id", "screening_id"),
        Index("idx_predictions_image_id", "screening_image_id"),
        Index("idx_predictions_model_id", "ai_model_id"),
    )

    # Relationships
    screening: Mapped[Screening] = relationship(
        "Screening",
        back_populates="ai_predictions",
    )
    screening_image: Mapped[ScreeningImage] = relationship(
        "ScreeningImage",
        back_populates="ai_predictions",
    )
    ai_model: Mapped[AIModel] = relationship(
        "AIModel",
        back_populates="predictions",
    )
    probabilities: Mapped[List[PredictionProbability]] = relationship(
        "PredictionProbability",
        back_populates="ai_prediction",
        cascade="all, delete-orphan",
    )
    xai_results: Mapped[List[XAIResult]] = relationship(
        "XAIResult",
        back_populates="ai_prediction",
        cascade="all, delete-orphan",
    )
    risk_assessments: Mapped[List[RiskAssessment]] = relationship(
        "RiskAssessment",
        back_populates="ai_prediction",
    )

