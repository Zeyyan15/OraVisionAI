"""
OraVisionAI — Conversation Pydantic Schemas

Strict validation schemas for direct patient-dentist messaging channels.
"""

from __future__ import annotations

import datetime
import uuid
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class ConversationCreate(BaseModel):
    """Payload for initiating a direct conversation.

    Empty payload: conversation_type is strictly server-assigned as 'direct'.
    Client-supplied identity, type, or state fields are strictly forbidden.
    """

    model_config = ConfigDict(extra="forbid")


class ConversationArchive(BaseModel):
    """Payload for archiving a conversation.

    Empty payload: server unconditionally marks is_active = False.
    """

    model_config = ConfigDict(extra="forbid")


class ConversationResponse(BaseModel):
    """Full representation of a conversation thread."""

    id: uuid.UUID
    patient_id: uuid.UUID
    dentist_id: uuid.UUID
    stream_channel_id: str
    conversation_type: str
    is_active: bool
    last_message_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    patient_name: Optional[str] = None
    dentist_name: Optional[str] = None
    clinic_name: Optional[str] = None
    unread_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class ConversationListResponse(BaseModel):
    """Response container for listing conversation threads."""

    total: int
    items: List[ConversationResponse]
