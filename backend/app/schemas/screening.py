"""
OraVisionAI — Screening Pydantic Schemas

Data transfer schemas for patient screening sessions, image attachments, and deletion confirmations.
"""

from __future__ import annotations

import datetime
import uuid
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ScreeningCreate(BaseModel):
    """Payload for creating a new patient screening session."""

    clinical_notes: Optional[str] = Field(
        None,
        max_length=2000,
        description="Patient-reported symptoms or initial notes",
    )

    model_config = ConfigDict(extra="forbid")


class ScreeningImageResponse(BaseModel):
    """Metadata response for an uploaded oral photograph."""

    id: uuid.UUID
    screening_id: uuid.UUID
    storage_path: str
    file_name: str
    file_size_bytes: int
    mime_type: str
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    image_sha256: Optional[str] = None
    is_primary: bool
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class ScreeningResponse(BaseModel):
    """Summary response for a screening session."""

    id: uuid.UUID
    patient_id: uuid.UUID
    created_by_id: uuid.UUID
    status: str
    clinical_notes: Optional[str] = None
    error_message: Optional[str] = None
    is_deleted: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class ScreeningDetailResponse(ScreeningResponse):
    """Detailed screening session response including all attached image records."""

    images: List[ScreeningImageResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ScreeningListResponse(BaseModel):
    """Paginated list of patient screening sessions."""

    items: List[ScreeningResponse]
    total: int
    page: int
    page_size: int


class ScreeningDeleteResponse(BaseModel):
    """Confirmation payload for soft-deleting a screening session."""

    success: bool
    message: str
    screening_id: uuid.UUID
