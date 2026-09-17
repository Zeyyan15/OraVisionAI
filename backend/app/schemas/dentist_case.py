"""
OraVisionAI — Dentist Patient Cases Discovery Schema
"""

from __future__ import annotations

import datetime
import uuid
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class DentistPatientCaseItem(BaseModel):
    """Minimal authorized clinical screening case representation for dentist discovery."""

    screening_id: uuid.UUID
    patient_id: uuid.UUID
    patient_name: str
    screening_date: datetime.datetime
    status: str
    ai_class: Optional[str] = None
    risk_level: Optional[str] = None
    risk_score: Optional[float] = None
    review_status: str  # "pending_review", "finalized", "consultation_linked"
    assessment_id: Optional[uuid.UUID] = None

    model_config = ConfigDict(from_attributes=True)


class DentistPatientCaseListResponse(BaseModel):
    """Container for authorized dentist patient cases."""

    items: List[DentistPatientCaseItem]
    total: int

    model_config = ConfigDict(from_attributes=True)

