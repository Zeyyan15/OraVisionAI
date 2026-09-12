"""
OraVisionAI — Risk Assessment Model

Synthesized multi-model risk assessment score, triage category, and contributing clinical factors.
"""

from __future__ import annotations

import datetime
import decimal
import uuid
from typing import TYPE_CHECKING, Any, List, Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.ai_prediction import AIPrediction
    from app.models.screening import Screening


class RiskAssessment(Base):
    """Automated risk tier and triage recommendation calculated from AI inferences and clinical history."""

    __tablename__ = "risk_assessments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    screening_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("screenings.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    ai_prediction_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_predictions.id", ondelete="SET NULL"),
        nullable=True,
    )
    risk_level: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
    )
    risk_score: Mapped[decimal.Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
    )
    contributing_factors: Mapped[List[Any]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )
    summary: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    recommended_action: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "risk_level IN ('low', 'moderate', 'high', 'critical')",
            name="chk_risk_level",
        ),
        CheckConstraint(
            "risk_score >= 0.0 AND risk_score <= 100.0",
            name="chk_risk_score",
        ),
        Index("idx_risk_screening_id", "screening_id", unique=True),
        Index("idx_risk_level", "risk_level"),
    )

    # Relationships
    screening: Mapped[Screening] = relationship(
        "Screening",
        back_populates="risk_assessment",
    )
    ai_prediction: Mapped[Optional[AIPrediction]] = relationship(
        "AIPrediction",
        back_populates="risk_assessments",
    )

