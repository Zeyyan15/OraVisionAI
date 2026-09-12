"""
OraVisionAI — Dentist Availability Pydantic Schemas

Defines request and response schemas for weekly recurring consultation availability
windows, slot durations, and active states for licensed dentists.
"""

from __future__ import annotations

import datetime
import uuid
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class DentistAvailabilityCreate(BaseModel):
    """Payload for creating a weekly recurring consultation window."""

    day_of_week: int = Field(
        ...,
        ge=0,
        le=6,
        description="Day of week (0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday)",
        examples=[1],
    )
    start_time: datetime.time = Field(
        ...,
        description="Window start time (HH:MM:SS)",
        examples=["09:00:00"],
    )
    end_time: datetime.time = Field(
        ...,
        description="Window end time (HH:MM:SS)",
        examples=["12:00:00"],
    )
    slot_duration_minutes: int = Field(
        default=30,
        gt=0,
        description="Length of individual consultation slot in minutes",
        examples=[30],
    )
    is_active: bool = Field(
        default=True,
        description="Whether this availability window is active for booking",
    )

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validate_time_window(self) -> DentistAvailabilityCreate:
        if self.start_time >= self.end_time:
            raise ValueError("end_time must be strictly after start_time.")
        return self


class DentistAvailabilityUpdate(BaseModel):
    """Payload for updating an existing availability window."""

    day_of_week: Optional[int] = Field(
        default=None,
        ge=0,
        le=6,
        description="Day of week (0 = Sunday ... 6 = Saturday)",
    )
    start_time: Optional[datetime.time] = Field(
        default=None,
        description="Window start time (HH:MM:SS)",
    )
    end_time: Optional[datetime.time] = Field(
        default=None,
        description="Window end time (HH:MM:SS)",
    )
    slot_duration_minutes: Optional[int] = Field(
        default=None,
        gt=0,
        description="Length of individual consultation slot in minutes",
    )
    is_active: Optional[bool] = Field(
        default=None,
        description="Whether this availability window is active",
    )

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validate_time_window(self) -> DentistAvailabilityUpdate:
        if self.start_time is not None and self.end_time is not None:
            if self.start_time >= self.end_time:
                raise ValueError("end_time must be strictly after start_time.")
        return self


class DentistAvailabilityResponse(BaseModel):
    """Full representation of a dentist consultation availability window."""

    id: uuid.UUID
    dentist_id: uuid.UUID
    day_of_week: int
    start_time: datetime.time
    end_time: datetime.time
    slot_duration_minutes: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class DentistAvailabilityListResponse(BaseModel):
    """Container for listing availability windows."""

    items: List[DentistAvailabilityResponse]
    total: int

    model_config = ConfigDict(from_attributes=True)

