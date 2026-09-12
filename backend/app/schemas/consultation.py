"""
OraVisionAI — Consultation Pydantic Schemas

Defines request and response schemas for teleconsultation sessions, lifecycle state
transitions, duration calculations, post-consultation summaries, and queries.
"""

from __future__ import annotations

import datetime
import uuid
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

VALID_CONSULTATION_TYPES = {"video", "audio", "chat"}
VALID_SESSION_STATUSES = {"scheduled", "active", "ended", "failed"}


class ConsultationCreate(BaseModel):
    """Payload for creating a consultation session for a confirmed appointment.

    NOTE: Strictly limited to client-authored consultation intent (consultation_type).
    All participant identities (patient_id, dentist_id, appointment_id), timestamps,
    status fields, and server-generated stream identifiers are strictly excluded.
    """

    consultation_type: str = Field(
        default="video",
        description="Mode of consultation (video, audio, chat)",
        examples=["video"],
    )

    model_config = ConfigDict(extra="forbid")

    @field_validator("consultation_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in VALID_CONSULTATION_TYPES:
            raise ValueError(
                f"Invalid consultation_type '{v}'. Must be one of: {sorted(VALID_CONSULTATION_TYPES)}"
            )
        return v


class ConsultationStart(BaseModel):
    """Payload for initiating a teleconsultation session."""

    model_config = ConfigDict(extra="forbid")


class ConsultationEnd(BaseModel):
    """Payload for concluding an active teleconsultation session."""

    clinical_summary: Optional[str] = Field(
        default=None,
        description="Optional post-consultation summary or clinical impressions from treating dentist",
        examples=["Consultation completed successfully. Advised follow-up biopsy at clinic."],
    )

    model_config = ConfigDict(extra="forbid")


class ConsultationFail(BaseModel):
    """Payload for marking a teleconsultation session as failed.

    NOTE: Extra fields are strictly forbidden. The database model contains no
    failure_reason column, and no alternative persistence is invented.
    """

    model_config = ConfigDict(extra="forbid")


class ConsultationResponse(BaseModel):
    """Complete representation of a teleconsultation session record."""

    id: uuid.UUID
    appointment_id: uuid.UUID
    patient_id: uuid.UUID
    dentist_id: uuid.UUID
    stream_call_id: str
    stream_channel_id: Optional[str] = None
    consultation_type: str
    session_status: str
    started_at: Optional[datetime.datetime] = None
    ended_at: Optional[datetime.datetime] = None
    duration_seconds: int = 0
    clinical_summary: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    # Contextual display fields
    patient_name: Optional[str] = None
    dentist_name: Optional[str] = None
    clinic_name: Optional[str] = None
    scheduled_start: Optional[datetime.datetime] = None
    scheduled_end: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ConsultationListResponse(BaseModel):
    """Container for listed consultation sessions."""

    items: List[ConsultationResponse]
    total: int

    model_config = ConfigDict(from_attributes=True)
