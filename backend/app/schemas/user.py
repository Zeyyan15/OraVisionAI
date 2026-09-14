"""
OraVisionAI — User Pydantic Schemas

Data transfer schemas for user identity, profiles, and role management.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class UserBase(BaseModel):
    email: str = Field(..., max_length=255)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone_number: Optional[str] = Field(None, max_length=30)
    avatar_url: Optional[str] = None


class UserCreate(UserBase):
    role: str = Field(default="patient", description="Requested initial role: 'patient' or 'dentist'")

    model_config = ConfigDict(extra="forbid")


class UserSyncRequest(BaseModel):
    role: Optional[str] = Field(default="patient", description="Requested role: 'patient' or 'dentist'")
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    phone_number: Optional[str] = Field(None, max_length=30)

    model_config = ConfigDict(extra="forbid")


class UserUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone_number: Optional[str] = Field(None, max_length=30)
    avatar_url: Optional[str] = None

    model_config = ConfigDict(extra="forbid")


class UserResponse(BaseModel):
    id: uuid.UUID
    firebase_uid: str
    email: str
    role: str
    first_name: str
    last_name: str
    phone_number: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    is_email_verified: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class RoleAccessResponse(BaseModel):
    access: str = "granted"
    role: str
    user_id: uuid.UUID
