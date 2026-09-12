"""
OraVisionAI — Patient Pydantic Schemas

Data transfer schemas for patient personal profiles and clinical medical profiles.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

ALLOWED_GENDERS = {"male", "female", "other", "prefer_not_to_say"}
ALLOWED_SMOKING_STATUS = {"never", "former", "occasional", "regular", "heavy"}
ALLOWED_ALCOHOL_CONSUMPTION = {"none", "occasional", "moderate", "frequent"}


class PatientBase(BaseModel):
    date_of_birth: Optional[datetime.date] = None
    gender: Optional[str] = Field(
        None,
        description="Gender: 'male', 'female', 'other', 'prefer_not_to_say'",
    )
    emergency_contact_name: Optional[str] = Field(None, max_length=150)
    emergency_contact_phone: Optional[str] = Field(None, max_length=30)
    address: Optional[str] = None

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.lower() not in ALLOWED_GENDERS:
            raise ValueError(f"Invalid gender '{v}'. Allowed values: {sorted(ALLOWED_GENDERS)}")
        return v.lower() if v is not None else None


class PatientUpdate(PatientBase):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone_number: Optional[str] = Field(None, max_length=30)
    avatar_url: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class PatientResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    phone_number: Optional[str] = None
    avatar_url: Optional[str] = None
    date_of_birth: Optional[datetime.date] = None
    gender: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    address: Optional[str] = None
    has_medical_profile: bool = False
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class PatientMedicalProfileBase(BaseModel):
    medical_history: List[str] = Field(default_factory=list)
    dental_history: List[str] = Field(default_factory=list)
    allergies: List[str] = Field(default_factory=list)
    current_medications: List[str] = Field(default_factory=list)
    smoking_status: Optional[str] = Field(default="never")
    alcohol_consumption: Optional[str] = Field(default="none")
    betel_quid_user: bool = Field(default=False)
    additional_notes: Optional[str] = Field(None)

    @field_validator("smoking_status")
    @classmethod
    def validate_smoking_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.lower() not in ALLOWED_SMOKING_STATUS:
            raise ValueError(f"Invalid smoking status '{v}'. Allowed values: {sorted(ALLOWED_SMOKING_STATUS)}")
        return v.lower() if v is not None else None

    @field_validator("alcohol_consumption")
    @classmethod
    def validate_alcohol_consumption(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.lower() not in ALLOWED_ALCOHOL_CONSUMPTION:
            raise ValueError(f"Invalid alcohol consumption '{v}'. Allowed values: {sorted(ALLOWED_ALCOHOL_CONSUMPTION)}")
        return v.lower() if v is not None else None


class PatientMedicalProfileCreate(PatientMedicalProfileBase):
    model_config = ConfigDict(extra="forbid")


class PatientMedicalProfileUpdate(BaseModel):
    medical_history: Optional[List[str]] = None
    dental_history: Optional[List[str]] = None
    allergies: Optional[List[str]] = None
    current_medications: Optional[List[str]] = None
    smoking_status: Optional[str] = None
    alcohol_consumption: Optional[str] = None
    betel_quid_user: Optional[bool] = None
    additional_notes: Optional[str] = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("smoking_status")
    @classmethod
    def validate_smoking_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.lower() not in ALLOWED_SMOKING_STATUS:
            raise ValueError(f"Invalid smoking status '{v}'. Allowed values: {sorted(ALLOWED_SMOKING_STATUS)}")
        return v.lower() if v is not None else None

    @field_validator("alcohol_consumption")
    @classmethod
    def validate_alcohol_consumption(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.lower() not in ALLOWED_ALCOHOL_CONSUMPTION:
            raise ValueError(f"Invalid alcohol consumption '{v}'. Allowed values: {sorted(ALLOWED_ALCOHOL_CONSUMPTION)}")
        return v.lower() if v is not None else None


class PatientMedicalProfileResponse(PatientMedicalProfileBase):
    id: uuid.UUID
    patient_id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
