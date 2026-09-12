"""
OraVisionAI — Risk Assessment & Clinical Context Pydantic Schemas

Data transfer schemas for deterministic clinical context evaluation,
screening triage levels, and traceable contributing factors.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

DEFAULT_CLINICAL_DISCLAIMER = (
    "This screening risk assessment and triage tier is an automated decision-support synthesis "
    "of preliminary AI image findings and self-reported patient context. It does NOT constitute "
    "a definitive medical or dental diagnosis, disease staging, or treatment plan. It is intended "
    "solely to assist in scheduling and prioritizing professional evaluation. Comprehensive clinical "
    "examination by a licensed dental professional is required."
)


class ContributingFactorItem(BaseModel):
    """Traceable, factual clinical observation or screening finding."""

    category: str = Field(..., description="Evidence category (e.g. AI Classification, Lifestyle Context)")
    observation: str = Field(..., description="Factual description of the observed finding")
    source: str = Field(..., description="Source entity (e.g. ai_predictions, patient_medical_profiles)")


class RiskAssessmentRequest(BaseModel):
    """Payload for requesting or recomputing a screening risk assessment."""

    force_recompute: bool = Field(
        default=False,
        description="Whether to recompute and update the risk assessment if an existing record exists",
    )

    model_config = ConfigDict(extra="forbid")


class RiskAssessmentResponse(BaseModel):
    """Structured response for an automated screening triage evaluation."""

    id: uuid.UUID
    screening_id: uuid.UUID
    ai_prediction_id: Optional[uuid.UUID] = None
    risk_level: Literal["low", "moderate", "high", "critical"]
    risk_score: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Technical ordinal index representing the screening triage tier (low: 25.0, moderate: 50.0, high: 75.0, critical: 100.0). Does NOT represent disease probability.",
    )
    contributing_factors: List[ContributingFactorItem] = Field(default_factory=list)
    summary: str
    recommended_action: str
    created_at: datetime.datetime
    engine_version: str = "v1.0"
    disclaimer: str = DEFAULT_CLINICAL_DISCLAIMER

    model_config = ConfigDict(from_attributes=True)

