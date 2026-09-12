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

    model_config = ConfigDict(extra="forbid")


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
