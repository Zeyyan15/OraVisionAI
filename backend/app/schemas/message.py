"""
OraVisionAI — Message Pydantic Schemas

Strict validation schemas for direct patient-dentist text messages.
"""

from __future__ import annotations

import datetime
import uuid
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class MessageCreate(BaseModel):
    """Payload for creating a text message.

    Supports text messages only. All client-supplied identity, storage, or stream fields are strictly forbidden.
    """

    content: str = Field(..., min_length=1, max_length=4000)
    message_type: Literal["text"] = "text"
    message_type: Literal["text", "attachment", "report_share"] = "text"

    model_config = ConfigDict(extra="forbid")


class MessageAttachmentResponse(BaseModel):
    """Public representation of a file attachment associated with a message."""

    id: uuid.UUID
    message_id: uuid.UUID
    original_filename: str
    mime_type: str
    file_size: int
    attachment_type: str
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class AttachmentUrlResponse(BaseModel):
    """Authorized time-limited signed download/view URL for an attachment."""

    attachment_id: uuid.UUID
    signed_url: str
    expires_in: int = 900
    filename: str
    mime_type: str


class ReportShareRequest(BaseModel):
    """Payload for sharing an existing clinical report in a conversation."""

    report_id: uuid.UUID = Field(..., description="UUID of the existing authorized clinical report")
    note: Optional[str] = Field(None, max_length=1000, description="Optional clinical note accompanying the report")


class ShareableReportItem(BaseModel):
    """Safe summary of a clinical report available to share in the active conversation."""

    id: uuid.UUID
    report_number: str
    report_title: str
    created_at: datetime.datetime
    summary: Optional[str] = None
    screening_id: uuid.UUID

    model_config = ConfigDict(from_attributes=True)


class MessageResponse(BaseModel):
    """Full representation of a message record."""

    id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    stream_message_id: Optional[str] = None
    message_type: str
    content: str
    attachment_storage_path: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime
    sender_name: Optional[str] = None
    sender_role: Optional[str] = None
    report_id: Optional[uuid.UUID] = None
    report_number: Optional[str] = None
    report_title: Optional[str] = None
    attachments: List[MessageAttachmentResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class MessageListResponse(BaseModel):
    """Paginated list container for messages within a conversation."""

    total: int
    limit: int
    offset: int
    items: List[MessageResponse]


class MessageReadResponse(BaseModel):
    """Response returned when marking messages as read."""

    marked_read_count: int
    conversation_id: uuid.UUID
