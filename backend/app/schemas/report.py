"""
OraVisionAI — Clinical Report Pydantic Schemas

Data transfer schemas for clinical report generation, historical snapshot retrieval,
and PDF document downloads.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field


class ReportGenerateRequest(BaseModel):
    """Payload for initiating clinical report generation for a screening session."""

    force_regenerate: bool = Field(
        default=False,
        description="Whether to overwrite and regenerate existing report and PDF",
    )
    report_title: Optional[str] = Field(
        default="Oral Health AI Screening Report",
        max_length=200,
        description="Custom title for the clinical report",
    )

    model_config = ConfigDict(extra="forbid")


class ReportSummaryResponse(BaseModel):
    """Brief metadata summary for a generated clinical report."""

    id: uuid.UUID
    screening_id: uuid.UUID
    report_number: str
    report_title: str
    summary: Optional[str] = None
    pdf_storage_path: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class ReportResponse(BaseModel):
    """Detailed clinical report including complete frozen diagnostic snapshot."""

    id: uuid.UUID
    screening_id: uuid.UUID
    report_number: str
    generated_by_id: Optional[uuid.UUID] = None
    report_title: str
    summary: Optional[str] = None
    report_data: Dict[str, Any] = Field(
        default_factory=dict,
        description="Frozen historical diagnostic snapshot",
    )
    pdf_storage_path: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class ReportDownloadResponse(BaseModel):
    """Secure reference for downloading the clinical PDF report."""

    report_id: uuid.UUID
    report_number: str
    pdf_storage_path: str
    file_name: str
    mime_type: str = "application/pdf"
