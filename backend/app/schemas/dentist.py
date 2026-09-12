"""
OraVisionAI — Dentist Pydantic Schemas

Data transfer schemas for dentist professional profiles and verification document submissions.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class DentistBase(BaseModel):
    specialization: Optional[str] = Field("General Dentistry", max_length=150)
    clinic_name: Optional[str] = Field(None, max_length=200)
    clinic_address: Optional[str] = None
    years_of_experience: Optional[int] = Field(0, ge=0)
    bio: Optional[str] = None


class DentistUpdate(BaseModel):
    specialization: Optional[str] = Field(None, max_length=150)
    clinic_name: Optional[str] = Field(None, max_length=200)
    clinic_address: Optional[str] = None
    years_of_experience: Optional[int] = Field(None, ge=0)
    bio: Optional[str] = None
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone_number: Optional[str] = Field(None, max_length=30)
    avatar_url: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class DentistResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    phone_number: Optional[str] = None
    avatar_url: Optional[str] = None
    license_number: str
    specialization: str
    clinic_name: Optional[str] = None
    clinic_address: Optional[str] = None
    years_of_experience: int
    bio: Optional[str] = None
    verification_status: str
    verified_at: Optional[datetime.datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class DentistVerificationBase(BaseModel):
    document_type: str = Field(..., max_length=100)
    document_url: str = Field(...)
    file_name: str = Field(..., max_length=255)
    file_size_bytes: Optional[int] = Field(None, ge=0)


class DentistVerificationCreate(DentistVerificationBase):
    model_config = ConfigDict(extra="forbid")


class DentistVerificationResponse(DentistVerificationBase):
    id: uuid.UUID
    dentist_id: uuid.UUID
    status: str
    submitted_at: datetime.datetime
    reviewed_at: Optional[datetime.datetime] = None
    review_notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
