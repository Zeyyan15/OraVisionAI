"""
OraVisionAI — Dentist Assessment Pydantic Schemas

Defines request and response schemas for professional dentist clinical evaluations,
preliminary diagnosis, treatment recommendations, and screening review summaries.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.screening import ScreeningImageResponse


class DentistAssessmentCreate(BaseModel):
    """Payload for submitting a new professional clinical assessment."""

    clinical_observations: str = Field(
        ...,
        min_length=1,
        description="Clinical observations of the oral cavity by licensed dentist",
        examples=["Erythematous lesion localized on the lateral border of the tongue."],
    )
    diagnosis_notes: str = Field(
        ...,
        min_length=1,
        description="Professional clinical diagnosis or preliminary evaluation",
        examples=["Suspected oral lichen planus; differential includes leukoplakia."],
    )
    treatment_recommendation: str = Field(
        ...,
        min_length=1,
        description="Recommended clinical actions, procedures, or treatment plan",
        examples=["Schedule incisional biopsy and routine monitoring every 3 months."],
    )
    referral_needed: bool = Field(
        default=False,
        description="Whether an urgent referral to a specialist or hospital is required",
    )
    referral_specialty: Optional[str] = Field(
        default=None,
        max_length=150,
        description="Specialty referred to (e.g., Oral & Maxillofacial Surgery, Oral Pathology)",
        examples=["Oral & Maxillofacial Surgery"],
    )
    is_finalized: bool = Field(
        default=False,
        description="If True, finalizes and locks the assessment from further modifications",
    )

    model_config = ConfigDict(extra="forbid")


class DentistAssessmentUpdate(BaseModel):
    """Payload for updating an unfinalized dentist assessment draft."""

    clinical_observations: Optional[str] = Field(
        default=None,
        min_length=1,
        description="Updated clinical observations",
    )
    diagnosis_notes: Optional[str] = Field(
        default=None,
        min_length=1,
        description="Updated preliminary diagnosis notes",
    )
    treatment_recommendation: Optional[str] = Field(
        default=None,
        min_length=1,
        description="Updated treatment recommendations",
    )
    referral_needed: Optional[bool] = Field(
        default=None,
        description="Updated referral indication flag",
    )
    referral_specialty: Optional[str] = Field(
        default=None,
        max_length=150,
        description="Updated specialty referred to",
    )
    is_finalized: Optional[bool] = Field(
        default=None,
        description="Set to True to finalize and permanently lock the assessment",
    )

    model_config = ConfigDict(extra="forbid")


class DentistAssessmentResponse(BaseModel):
    """Response representation of a licensed dentist's clinical assessment."""

    id: uuid.UUID
    screening_id: uuid.UUID
    dentist_id: uuid.UUID
    clinical_observations: str
    diagnosis_notes: str
    treatment_recommendation: str
    referral_needed: bool
    referral_specialty: Optional[str] = None
    is_finalized: bool
    finalized_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    # Contextual metadata derived from existing User / Dentist models
    dentist_name: Optional[str] = None
    dentist_clinic: Optional[str] = None
    dentist_license: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ScreeningReviewResponse(BaseModel):
    """Consolidated clinical review package for an authorized treating dentist."""

    screening_id: uuid.UUID
    patient_id: uuid.UUID
    patient_name: str
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    patient_notes: Optional[str] = None
    screening_status: str
    screening_created_at: datetime.datetime
    total_images: int
    images: List[ScreeningImageResponse] = Field(default_factory=list)

    # Multi-modal automated findings (strictly separated from professional review)
    primary_prediction: Optional[Dict[str, Any]] = None
    yolo_detections: List[Dict[str, Any]] = Field(default_factory=list)
    xai_results: List[Dict[str, Any]] = Field(default_factory=list)
    risk_assessment: Optional[Dict[str, Any]] = None

    # Existing dentist assessments
    dentist_assessments: List[DentistAssessmentResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

