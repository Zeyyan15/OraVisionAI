"""
OraVisionAI — Admin Pydantic Schemas

Data transfer schemas for administrative user management, dentist verification review, and audit trails.
"""

from __future__ import annotations

import datetime
import uuid
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class UserStatusUpdate(BaseModel):
    is_active: bool = Field(..., description="Target active status for the user account")

    model_config = ConfigDict(extra="forbid")


class AdminUserResponse(BaseModel):
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
    has_patient_profile: bool = False
    has_dentist_profile: bool = False
    dentist_verification_status: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class AdminUserListResponse(BaseModel):
    items: List[AdminUserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class VerificationReviewRequest(BaseModel):
    review_notes: Optional[str] = Field(
        None,
        max_length=1000,
        description="Optional administrative review notes or rejection reason",
    )

    model_config = ConfigDict(extra="forbid")


class AdminDentistVerificationResponse(BaseModel):
    id: uuid.UUID
    dentist_id: uuid.UUID
    dentist_user_id: Optional[uuid.UUID] = None
    dentist_name: Optional[str] = None
    dentist_email: Optional[str] = None
    license_number: Optional[str] = None
    specialization: Optional[str] = None
    document_type: str
    document_url: str
    file_name: str
    file_size_bytes: Optional[int] = None
    status: str
    reviewer_id: Optional[uuid.UUID] = None
    review_notes: Optional[str] = None
    submitted_at: datetime.datetime
    reviewed_at: Optional[datetime.datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AdminVerificationListResponse(BaseModel):
    items: List[AdminDentistVerificationResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
