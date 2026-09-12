"""
OraVisionAI — Conversations & Messaging API Router

Provides all 9 endpoints for direct messaging between patients and dentists:
1. POST  /api/dentists/{dentist_id}/conversations
2. POST  /api/patients/{patient_id}/conversations
3. GET   /api/conversations
4. GET   /api/conversations/{conversation_id}
5. PATCH /api/conversations/{conversation_id}/archive
6. POST  /api/conversations/{conversation_id}/messages
7. GET   /api/conversations/{conversation_id}/messages
8. GET   /api/conversations/{conversation_id}/messages/{message_id}
9. PATCH /api/conversations/{conversation_id}/read
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.conversation import (
    ConversationArchive,
    ConversationCreate,
    ConversationListResponse,
    ConversationResponse,
)
from app.schemas.message import (
    MessageCreate,
    MessageListResponse,
    MessageReadResponse,
    MessageResponse,
)
from app.services.conversation_service import ConversationService

router = APIRouter(tags=["Conversations"])


@router.post(
    "/dentists/{dentist_id}/conversations",
    response_model=ConversationResponse,
    summary="Initiate or reactivate conversation with a dentist (Patient only)",
)
async def create_conversation_with_dentist(
    dentist_id: uuid.UUID,
    data: ConversationCreate,
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationResponse:
    """Initiate a new direct conversation or reactivate/return an existing thread with target dentist.

    Requires an active PatientDentistRelationship.
    Returns 201 Created if newly created, or 200 OK if existing/reactivated.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    conv_resp, is_created = await ConversationService.create_or_reactivate_for_patient(
        db=db,
        dentist_id=dentist_id,
        user=current_user,
        data=data,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    if is_created:
        response.status_code = status.HTTP_201_CREATED
    else:
        response.status_code = status.HTTP_200_OK
    return conv_resp


@router.post(
    "/patients/{patient_id}/conversations",
    response_model=ConversationResponse,
    summary="Initiate or reactivate conversation with a patient (Dentist only)",
)
async def create_conversation_with_patient(
    patient_id: uuid.UUID,
    data: ConversationCreate,
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationResponse:
    """Initiate a new direct conversation or reactivate/return an existing thread with target patient.

    Requires an active PatientDentistRelationship and approved dentist verification.
    Returns 201 Created if newly created, or 200 OK if existing/reactivated.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    conv_resp, is_created = await ConversationService.create_or_reactivate_for_dentist(
        db=db,
        patient_id=patient_id,
        user=current_user,
        data=data,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    if is_created:
        response.status_code = status.HTTP_201_CREATED
    else:
        response.status_code = status.HTTP_200_OK
    return conv_resp


@router.get(
    "/conversations",
    response_model=ConversationListResponse,
    summary="List conversation threads",
)
async def list_conversations(
    request: Request,
    is_active: Optional[bool] = Query(None, description="Filter by active/archived status"),
    patient_id: Optional[uuid.UUID] = Query(None, description="Filter by patient ID (Admin only)"),
    dentist_id: Optional[uuid.UUID] = Query(None, description="Filter by dentist ID (Admin only)"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationListResponse:
    """List conversation threads scoped to the authenticated caller."""
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await ConversationService.list_conversations(
        db=db,
        user=current_user,
        is_active=is_active,
        patient_id=patient_id,
        dentist_id=dentist_id,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationResponse,
    summary="Get conversation thread details",
)
async def get_conversation(
    conversation_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationResponse:
    """Retrieve details of a specific conversation. Restricted to participants or admin."""
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await ConversationService.get_conversation_by_id(
        db=db,
        conversation_id=conversation_id,
        user=current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.patch(
    "/conversations/{conversation_id}/archive",
    response_model=ConversationResponse,
    summary="Archive a conversation thread",
)
async def archive_conversation(
    conversation_id: uuid.UUID,
    data: ConversationArchive,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ConversationResponse:
    """Archive a conversation thread. Sets is_active = False. Archived conversations reject new messages."""
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await ConversationService.archive_conversation(
        db=db,
        conversation_id=conversation_id,
        user=current_user,
        data=data,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Post a text message in an active conversation",
)
async def send_message(
    conversation_id: uuid.UUID,
    data: MessageCreate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Send a text message in an active conversation thread.

    Sender identity is strictly derived from the authenticated caller.
    Admins cannot send messages (403 Forbidden).
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await ConversationService.send_message(
        db=db,
        conversation_id=conversation_id,
        user=current_user,
        data=data,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=MessageListResponse,
    summary="List messages in a conversation (chronological)",
)
async def list_messages(
    conversation_id: uuid.UUID,
    request: Request,
    limit: int = Query(50, ge=1, le=100, description="Number of messages to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> MessageListResponse:
    """Retrieve messages in a conversation ordered chronologically (created_at ASC).

    Restricted to conversation participants or administrators (read-only oversight).
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await ConversationService.list_messages(
        db=db,
        conversation_id=conversation_id,
        user=current_user,
        limit=limit,
        offset=offset,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.get(
    "/conversations/{conversation_id}/messages/{message_id}",
    response_model=MessageResponse,
    summary="Get single message details",
)
async def get_message(
    conversation_id: uuid.UUID,
    message_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Retrieve details of a single message. Restricted to participants or admin."""
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await ConversationService.get_message_by_id(
        db=db,
        conversation_id=conversation_id,
        message_id=message_id,
        user=current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.patch(
    "/conversations/{conversation_id}/read",
    response_model=MessageReadResponse,
    summary="Mark unread incoming messages as read",
)
async def mark_messages_read(
    conversation_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> MessageReadResponse:
    """Mark all unread incoming messages sent by the other participant as read.

    Admins cannot alter read states (403 Forbidden).
    Senders cannot mark their own messages as read.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await ConversationService.mark_messages_read(
        db=db,
        conversation_id=conversation_id,
        user=current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )
