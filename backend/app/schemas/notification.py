"""
OraVisionAI — Notification Schemas

Pydantic request and response schemas for user in-app notifications.
Notifications are strictly server-generated; no public creation schema is exposed.
"""

from __future__ import annotations

import datetime
import uuid
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class NotificationResponse(BaseModel):
    """Public representation of an in-app notification record."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    notification_type: str
    title: str
    message: str
    action_url: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime.datetime] = None
    created_at: datetime.datetime


class NotificationListResponse(BaseModel):
    """Paginated collection of user notifications with unread counter."""

    items: List[NotificationResponse]
    total: int = Field(..., ge=0, description="Total matching notifications for this query")
    limit: int = Field(..., ge=1, le=100, description="Page size limit")
    offset: int = Field(..., ge=0, description="Pagination offset")
    unread_count: int = Field(..., ge=0, description="Total unread notifications for the user")


class NotificationUnreadCountResponse(BaseModel):
    """Lightweight response for unread notification count badge."""

    unread_count: int = Field(..., ge=0, description="Number of unread notifications")


class NotificationReadAllResponse(BaseModel):
    """Response payload returned when marking all unread notifications as read."""

    marked_read_count: int = Field(..., ge=0, description="Number of notifications marked as read")
