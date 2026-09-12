"""
OraVisionAI — Notifications API Router

Provides REST endpoints for user in-app notification queries, read receipts, and unread counts.
All endpoints require authentication; users access only their own notifications.
No public notification creation endpoint exists.
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.notification import (
    NotificationListResponse,
    NotificationReadAllResponse,
    NotificationResponse,
    NotificationUnreadCountResponse,
)
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get(
    "",
    response_model=NotificationListResponse,
    status_code=status.HTTP_200_OK,
    summary="List notifications for current user",
)
async def list_notifications(
    is_read: Optional[bool] = Query(None, description="Filter by read status (true/false)"),
    limit: int = Query(50, ge=1, le=100, description="Max notifications to return"),
    offset: int = Query(0, ge=0, description="Number of notifications to skip"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationListResponse:
    """Retrieve a paginated list of notifications owned by the authenticated user."""
    items, total, unread_count = await NotificationService.list_notifications(
        db=db,
        user_id=current_user.id,
        is_read=is_read,
        limit=limit,
        offset=offset,
    )
    return NotificationListResponse(
        items=[NotificationResponse.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
        unread_count=unread_count,
    )


@router.get(
    "/unread-count",
    response_model=NotificationUnreadCountResponse,
    status_code=status.HTTP_200_OK,
    summary="Get unread notification count",
)
async def get_unread_count(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationUnreadCountResponse:
    """Get the total number of unread notifications for the current user."""
    count = await NotificationService.get_unread_count(
        db=db,
        user_id=current_user.id,
    )
    return NotificationUnreadCountResponse(unread_count=count)


@router.get(
    "/{id}",
    response_model=NotificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Get notification by ID",
)
async def get_notification(
    id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationResponse:
    """Retrieve a specific notification owned by the authenticated user."""
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    notification = await NotificationService.get_notification_by_id(
        db=db,
        user_id=current_user.id,
        notification_id=id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return NotificationResponse.model_validate(notification)


@router.patch(
    "/{id}/read",
    response_model=NotificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark notification as read",
)
async def mark_notification_read(
    id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationResponse:
    """Mark an individual notification as read idempotently."""
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    notification = await NotificationService.mark_as_read(
        db=db,
        user_id=current_user.id,
        notification_id=id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return NotificationResponse.model_validate(notification)


@router.patch(
    "/read-all",
    response_model=NotificationReadAllResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark all unread notifications as read",
)
async def mark_all_notifications_read(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationReadAllResponse:
    """Mark all unread notifications owned by the authenticated user as read."""
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    marked_count = await NotificationService.mark_all_as_read(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return NotificationReadAllResponse(marked_read_count=marked_count)
