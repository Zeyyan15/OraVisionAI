"""
OraVisionAI — Appointment Pydantic Schemas

Defines request and response schemas for consultation booking requests, schedules,
status lifecycle transitions, cancellations, and appointment queries.
"""

from __future__ import annotations

import datetime
import uuid
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

VALID_APPOINTMENT_TYPES = {
    "video_teleconsultation",
    "audio_teleconsultation",
    "in_person_consultation",
    "follow_up",
}

VALID_STATUSES = {
    "requested",
    "confirmed",
    "in_progress",
    "completed",
    "cancelled",
    "rescheduled",
    "no_show",
}


class AppointmentCreate(BaseModel):
    """Payload for booking/requesting an appointment.

    NOTE: Does NOT expose dentist_id, patient_id, appointment_id, status,
    or server-controlled timestamp fields. dentist_id is derived exclusively
    from the URL path parameter, and patient_id from the authenticated user.
    """

    scheduled_start: datetime.datetime = Field(
        ...,
        description="Appointment start time with timezone",
    )
    scheduled_end: datetime.datetime = Field(
        ...,
        description="Appointment end time with timezone",
    )
    appointment_type: str = Field(
        default="video_teleconsultation",
        description="Mode of consultation (video_teleconsultation, audio_teleconsultation, in_person_consultation, follow_up)",
    )
    screening_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Optional ID of associated patient oral screening",
    )
    patient_notes: Optional[str] = Field(
        default=None,
        description="Patient's description of concerns or reason for consultation",
    )

    model_config = ConfigDict(extra="forbid")

    @field_validator("appointment_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in VALID_APPOINTMENT_TYPES:
            raise ValueError(
                f"Invalid appointment_type '{v}'. Must be one of: {sorted(VALID_APPOINTMENT_TYPES)}"
            )
        return v

    @field_validator("scheduled_start", "scheduled_end", mode="after")
    @classmethod
    def ensure_utc_timezone(cls, v: datetime.datetime) -> datetime.datetime:
        if v.tzinfo is None:
            return v.replace(tzinfo=datetime.timezone.utc)
        return v.astimezone(datetime.timezone.utc)

    @model_validator(mode="after")
    def validate_time(self) -> AppointmentCreate:
        if self.scheduled_end <= self.scheduled_start:
            raise ValueError("scheduled_end must be strictly after scheduled_start.")
        return self


class AppointmentStatusUpdate(BaseModel):
    """Payload for updating appointment status by authorized actors."""

    status: str = Field(
        ...,
        description="Target appointment lifecycle status",
    )
    dentist_notes: Optional[str] = Field(
        default=None,
        description="Optional clinical or administrative notes from treating dentist",
    )

    model_config = ConfigDict(extra="forbid")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in VALID_STATUSES:
            raise ValueError(
                f"Invalid status '{v}'. Must be one of: {sorted(VALID_STATUSES)}"
            )
        return v


class AppointmentConfirm(BaseModel):
    """Optional payload when confirming an appointment."""

    dentist_notes: Optional[str] = Field(
        default=None,
        description="Optional clinical or administrative notes from treating dentist",
    )

    model_config = ConfigDict(extra="forbid")


class AppointmentCancel(BaseModel):
    """Payload for cancelling an appointment."""

    cancellation_reason: str = Field(
        ...,
        min_length=3,
        description="Mandatory explanation for cancelling the appointment",
        examples=["Patient requested rescheduling due to work conflict."],
    )

    model_config = ConfigDict(extra="forbid")


class AppointmentResponse(BaseModel):
    """Complete representation of an appointment record."""

    id: uuid.UUID
    patient_id: uuid.UUID
    dentist_id: uuid.UUID
    screening_id: Optional[uuid.UUID] = None
    scheduled_start: datetime.datetime
    scheduled_end: datetime.datetime
    appointment_type: str
    status: str
    cancellation_reason: Optional[str] = None
    cancelled_by_id: Optional[uuid.UUID] = None
    patient_notes: Optional[str] = None
    dentist_notes: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    # Optional clinical / administrative context
    patient_name: Optional[str] = None
    dentist_name: Optional[str] = None
    clinic_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AppointmentListResponse(BaseModel):
    """Container for paginated or listed appointments."""

    items: List[AppointmentResponse]
    total: int

    model_config = ConfigDict(from_attributes=True)

