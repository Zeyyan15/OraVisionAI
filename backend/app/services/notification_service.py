"""
OraVisionAI — Notification Domain Service

Manages in-app notification persistence, retrieval, read receipts, and server-controlled
lifecycle alerting for appointments, messaging, clinical assessments, screenings, and system alerts.
"""

from __future__ import annotations

import datetime
import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.notification import Notification
from app.models.user import User

logger = logging.getLogger("oravision.services.notification")

VALID_NOTIFICATION_TYPES = {
    "screening_completed",
    "screening_failed",
    "appointment_booked",
    "appointment_confirmed",
    "appointment_cancelled",
    "dentist_verified",
    "dentist_assessment_added",
    "new_message",
    "system_alert",
}


class NotificationService:
    """Domain service managing user in-app notifications and read lifecycle."""

    # =========================================================================
    # Notification Creation & System Alerts
    # =========================================================================

    @classmethod
    async def create_notification(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        notification_type: str,
        title: str,
        message: str,
        action_url: Optional[str] = None,
        suppress_duplicates_window_seconds: Optional[int] = 300,
    ) -> Notification:
        """
        Creates a persistent in-app notification record for a specific user.
        Validates notification_type against the database check constraint chk_notification_type.
        Applies best-effort duplicate suppression within the specified time window.
        Note: Concurrency-safe deduplication requires database-level unique constraints (deferred).
        """
        if notification_type not in VALID_NOTIFICATION_TYPES:
            raise ValueError(
                f"Invalid notification_type '{notification_type}'. "
                f"Permitted types: {sorted(VALID_NOTIFICATION_TYPES)}"
            )

        # Best-effort duplicate suppression
        if suppress_duplicates_window_seconds and suppress_duplicates_window_seconds > 0:
            window_start = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(
                seconds=suppress_duplicates_window_seconds
            )
            dup_stmt = (
                select(Notification)
                .where(
                    Notification.user_id == user_id,
                    Notification.notification_type == notification_type,
                    Notification.action_url == action_url,
                    Notification.created_at >= window_start,
                )
                .order_by(Notification.created_at.desc())
                .limit(1)
            )
            dup_res = await db.execute(dup_stmt)
            existing = dup_res.scalar_one_or_none()
            if existing is not None:
                logger.info(
                    "Duplicate notification suppressed for user %s (type: %s, action: %s)",
                    user_id,
                    notification_type,
                    action_url,
                )
                return existing

        notification = Notification(
            id=uuid.uuid4(),
            user_id=user_id,
            notification_type=notification_type,
            title=title.strip(),
            message=message.strip(),
            action_url=action_url.strip() if action_url else None,
            is_read=False,
            read_at=None,
        )
        db.add(notification)
        await db.flush()

        logger.info(
            "Created notification %s of type '%s' for user %s",
            notification.id,
            notification_type,
            user_id,
        )
        return notification

    @classmethod
    async def create_system_alert(
        cls,
        db: AsyncSession,
        target_user_id: uuid.UUID,
        title: str,
        message: str,
        action_url: Optional[str] = None,
    ) -> Notification:
        """
        Internal server-side method to generate a system alert for a target user.
        Enforces target user existence and restricts notification_type to 'system_alert'.
        No public client endpoint is exposed.
        """
        stmt = select(User.id).where(User.id == target_user_id)
        res = await db.execute(stmt)
        user_exists = res.scalar_one_or_none()
        if user_exists is None:
            raise LookupError(f"Target user '{target_user_id}' does not exist.")

        return await cls.create_notification(
            db=db,
            user_id=target_user_id,
            notification_type="system_alert",
            title=title,
            message=message,
            action_url=action_url,
            suppress_duplicates_window_seconds=60,
        )

    # =========================================================================
    # Queries & Listing
    # =========================================================================

    @classmethod
    async def list_notifications(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        is_read: Optional[bool] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Tuple[List[Notification], int, int]:
        """
        Lists notifications owned by the authenticated user with limit/offset pagination.
        Ordered newest first (created_at DESC), with deterministic tie-breaking (id DESC).
        Returns a tuple of (items, total_filtered_count, total_unread_count).
        """
        limit = max(1, min(limit, 100))
        offset = max(0, offset)

        # 1. Total matching filtered count
        count_stmt = (
            select(func.count(Notification.id))
            .where(Notification.user_id == user_id)
        )
        if is_read is not None:
            count_stmt = count_stmt.where(Notification.is_read == is_read)
        total_filtered = (await db.execute(count_stmt)).scalar() or 0

        # 2. Total unread count for user badge
        unread_stmt = (
            select(func.count(Notification.id))
            .where(
                Notification.user_id == user_id,
                Notification.is_read.is_(False),
            )
        )
        total_unread = (await db.execute(unread_stmt)).scalar() or 0

        # 3. Query items
        query_stmt = (
            select(Notification)
            .where(Notification.user_id == user_id)
        )
        if is_read is not None:
            query_stmt = query_stmt.where(Notification.is_read == is_read)

        query_stmt = (
            query_stmt
            .order_by(Notification.created_at.desc(), Notification.id.desc())
            .limit(limit)
            .offset(offset)
        )
        items = (await db.execute(query_stmt)).scalars().all()

        return list(items), total_filtered, total_unread

    @classmethod
    async def get_notification_by_id(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        notification_id: uuid.UUID,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Notification:
        """
        Retrieves a single notification owned by the authenticated user.
        Raises 404 Not Found if missing or owned by another user to prevent enumeration.
        Records an immutable NOTIFICATION_VIEWED audit entry.
        """
        stmt = (
            select(Notification)
            .where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
        res = await db.execute(stmt)
        notification = res.scalar_one_or_none()

        if notification is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found.",
            )

        audit_entry = AuditLog(
            user_id=user_id,
            action="NOTIFICATION_VIEWED",
            resource_type="notification",
            resource_id=str(notification_id),
            details={
                "user_id": str(user_id),
                "notification_type": notification.notification_type,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)
        await db.commit()

        return notification

    @classmethod
    async def get_unread_count(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> int:
        """
        Returns the scalar count of unread notifications for the user using idx_notifications_user_unread.
        """
        stmt = (
            select(func.count(Notification.id))
            .where(
                Notification.user_id == user_id,
                Notification.is_read.is_(False),
            )
        )
        return (await db.execute(stmt)).scalar() or 0

    # =========================================================================
    # Read State Transitions
    # =========================================================================

    @classmethod
    async def mark_as_read(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        notification_id: uuid.UUID,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Notification:
        """
        Marks an individual notification as read idempotently.
        If already read, returns the record without resetting read_at.
        If unread, transitions is_read to True, sets read_at, and records NOTIFICATION_READ audit log.
        """
        stmt = (
            select(Notification)
            .where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
            )
        )
        res = await db.execute(stmt)
        notification = res.scalar_one_or_none()

        if notification is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found.",
            )

        if not notification.is_read:
            now = datetime.datetime.now(datetime.timezone.utc)
            notification.is_read = True
            notification.read_at = now

            audit_entry = AuditLog(
                user_id=user_id,
                action="NOTIFICATION_READ",
                resource_type="notification",
                resource_id=str(notification_id),
                details={
                    "user_id": str(user_id),
                    "read_at": now.isoformat(),
                },
                ip_address=ip_address,
                user_agent=user_agent,
            )
            db.add(audit_entry)
            await db.commit()
            await db.refresh(notification)
            logger.info("Notification %s marked read by user %s", notification_id, user_id)

        return notification

    @classmethod
    async def mark_all_as_read(
        cls,
        db: AsyncSession,
        user_id: uuid.UUID,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> int:
        """
        Marks all unread notifications of the user as read using an atomic SQL UPDATE.
        Records a single NOTIFICATIONS_READ_ALL audit log if any records were updated.
        Returns the number of marked notifications.
        """
        now = datetime.datetime.now(datetime.timezone.utc)
        stmt = (
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read.is_(False),
            )
            .values(
                is_read=True,
                read_at=now,
            )
        )
        res = await db.execute(stmt)
        marked_count = res.rowcount or 0

        if marked_count > 0:
            audit_entry = AuditLog(
                user_id=user_id,
                action="NOTIFICATIONS_READ_ALL",
                resource_type="notification",
                resource_id=None,
                details={
                    "user_id": str(user_id),
                    "marked_read_count": marked_count,
                    "read_at": now.isoformat(),
                },
                ip_address=ip_address,
                user_agent=user_agent,
            )
            db.add(audit_entry)

        await db.commit()
        logger.info("Marked %d notifications read for user %s", marked_count, user_id)
        return marked_count

    # =========================================================================
    # Domain Workflow Helpers (Appointment, Message, Assessment, Screening)
    # =========================================================================

    @classmethod
    async def notify_appointment_booked(
        cls,
        db: AsyncSession,
        appointment: Any,
    ) -> Notification:
        """
        Generates an appointment_booked notification for the assigned dentist.
        Recipient is derived server-side: appointment.dentist.user_id.
        """
        recipient_id = appointment.dentist.user_id
        slot_date = str(appointment.slot_date)
        start_time = str(appointment.start_time)
        return await cls.create_notification(
            db=db,
            user_id=recipient_id,
            notification_type="appointment_booked",
            title="New Appointment Request",
            message=f"You have a new appointment booking request for {slot_date} at {start_time}.",
            action_url=f"/appointments/{appointment.id}",
        )

    @classmethod
    async def notify_appointment_confirmed(
        cls,
        db: AsyncSession,
        appointment: Any,
    ) -> Notification:
        """
        Generates an appointment_confirmed notification for the booking patient.
        Recipient is derived server-side: appointment.patient.user_id.
        """
        recipient_id = appointment.patient.user_id
        slot_date = str(appointment.slot_date)
        start_time = str(appointment.start_time)
        return await cls.create_notification(
            db=db,
            user_id=recipient_id,
            notification_type="appointment_confirmed",
            title="Appointment Confirmed",
            message=f"Your appointment scheduled for {slot_date} at {start_time} has been confirmed.",
            action_url=f"/appointments/{appointment.id}",
        )

    @classmethod
    async def notify_appointment_cancelled(
        cls,
        db: AsyncSession,
        appointment: Any,
        cancelling_user: User,
    ) -> List[Notification]:
        """
        Generates appointment_cancelled notification(s) based on caller identity:
        - Patient cancellation -> Assigned dentist receives notification.
        - Dentist cancellation -> Booking patient receives notification.
        - Admin cancellation -> BOTH booking patient and treating dentist receive notifications.
        Admin actor does not receive a notification.
        """
        slot_date = str(appointment.slot_date)
        start_time = str(appointment.start_time)
        action_url = f"/appointments/{appointment.id}"
        created_notifications: List[Notification] = []

        if cancelling_user.role == "patient":
            notif = await cls.create_notification(
                db=db,
                user_id=appointment.dentist.user_id,
                notification_type="appointment_cancelled",
                title="Appointment Cancelled",
                message=f"Your appointment scheduled on {slot_date} at {start_time} has been cancelled by the patient.",
                action_url=action_url,
            )
            created_notifications.append(notif)
        elif cancelling_user.role == "dentist":
            notif = await cls.create_notification(
                db=db,
                user_id=appointment.patient.user_id,
                notification_type="appointment_cancelled",
                title="Appointment Cancelled",
                message=f"Your appointment scheduled on {slot_date} at {start_time} has been cancelled by the dentist.",
                action_url=action_url,
            )
            created_notifications.append(notif)
        elif cancelling_user.role == "admin":
            # Both participants are notified of external administrative cancellation
            p_notif = await cls.create_notification(
                db=db,
                user_id=appointment.patient.user_id,
                notification_type="appointment_cancelled",
                title="Appointment Cancelled",
                message=f"The appointment scheduled on {slot_date} at {start_time} was cancelled by system administration.",
                action_url=action_url,
            )
            d_notif = await cls.create_notification(
                db=db,
                user_id=appointment.dentist.user_id,
                notification_type="appointment_cancelled",
                title="Appointment Cancelled",
                message=f"The appointment scheduled on {slot_date} at {start_time} was cancelled by system administration.",
                action_url=action_url,
            )
            created_notifications.extend([p_notif, d_notif])

        return created_notifications

    @classmethod
    async def notify_new_message(
        cls,
        db: AsyncSession,
        conversation: Any,
        sender_user: User,
    ) -> Optional[Notification]:
        """
        Generates a new_message notification for the opposing participant in a 1-to-1 conversation.
        Recipient is resolved server-side:
        - If sender is patient -> Recipient is dentist.
        - If sender is dentist -> Recipient is patient.
        Sender NEVER receives notification for their own message.
        Admin NEVER receives participant message notifications.
        Notification payload NEVER includes raw message plaintext.
        """
        recipient_id = None
        if conversation.patient and conversation.patient.user_id == sender_user.id:
            recipient_id = conversation.dentist.user_id if conversation.dentist else None
        elif conversation.dentist and conversation.dentist.user_id == sender_user.id:
            recipient_id = conversation.patient.user_id if conversation.patient else None

        if recipient_id is None or recipient_id == sender_user.id:
            return None

        sender_name = f"{sender_user.first_name} {sender_user.last_name}".strip() or "A user"
        if sender_user.role == "dentist":
            sender_name = f"Dr. {sender_name}"

        return await cls.create_notification(
            db=db,
            user_id=recipient_id,
            notification_type="new_message",
            title="New Message Received",
            message=f"You have received a new message from {sender_name}.",
            action_url=f"/conversations/{conversation.id}",
            suppress_duplicates_window_seconds=10,
        )

    @classmethod
    async def notify_dentist_assessment_added(
        cls,
        db: AsyncSession,
        assessment: Any,
        screening: Any,
    ) -> Optional[Notification]:
        """
        Generates a dentist_assessment_added notification for the screening patient.
        Triggered ONLY when assessment.is_finalized is True.
        Draft assessments must NEVER generate patient notifications.
        """
        if not getattr(assessment, "is_finalized", False):
            return None

        patient_user_id = screening.patient.user_id if (screening.patient and screening.patient.user) else None
        if patient_user_id is None:
            return None

        return await cls.create_notification(
            db=db,
            user_id=patient_user_id,
            notification_type="dentist_assessment_added",
            title="Dentist Assessment Available",
            message="A verified dentist has completed a clinical assessment for your oral health screening.",
            action_url=f"/screenings/{screening.id}",
        )

    @classmethod
    async def notify_screening_completed(
        cls,
        db: AsyncSession,
        screening: Any,
    ) -> Optional[Notification]:
        """
        Generates a screening_completed notification when AI inference analysis reaches 'completed' status.
        Recipient is the screening patient. Contains zero diagnostic or disease classification labels.
        """
        patient_user_id = screening.patient.user_id if (screening.patient and screening.patient.user) else None
        if patient_user_id is None:
            return None

        return await cls.create_notification(
            db=db,
            user_id=patient_user_id,
            notification_type="screening_completed",
            title="Screening Analysis Complete",
            message="Your oral health screening analysis has completed and is ready for review.",
            action_url=f"/screenings/{screening.id}",
        )

    @classmethod
    async def notify_screening_failed(
        cls,
        db: AsyncSession,
        screening: Any,
        error_message: Optional[str] = None,
    ) -> Optional[Notification]:
        """
        Generates a screening_failed notification when screening processing encounters an unrecoverable failure.
        """
        patient_user_id = screening.patient.user_id if (screening.patient and screening.patient.user) else None
        if patient_user_id is None:
            return None

        return await cls.create_notification(
            db=db,
            user_id=patient_user_id,
            notification_type="screening_failed",
            title="Screening Processing Error",
            message="An issue occurred while processing your screening images. Please re-upload or contact support.",
            action_url=f"/screenings/{screening.id}",
        )
