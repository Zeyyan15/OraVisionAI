"""
OraVisionAI — Conversation & Messaging Domain Service

Encapsulates all domain logic for:
1. Patient-dentist direct conversation thread initiation and server-controlled reactivation
2. Idempotent thread retrieval and unique-constraint concurrency handling
3. Message posting with strictly server-derived identity and text-only enforcement
4. Message listing with standard limit/offset pagination ordered chronologically
5. Single-statement atomic read receipts
6. Comprehensive immutable audit logging without plaintext message or attachment leakage
"""

from __future__ import annotations

import datetime
import logging
import uuid
from typing import Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.appointment import Appointment
from app.models.audit_log import AuditLog
from app.models.conversation import Conversation
from app.models.dentist import Dentist
from app.models.message import Message
from app.models.message_attachment import MessageAttachment
from app.models.patient import Patient
from app.models.patient_dentist_relationship import PatientDentistRelationship
from app.models.report import Report
from app.models.screening import Screening
from app.models.user import User
from app.schemas.conversation import (
    ConversationArchive,
    ConversationCreate,
    ConversationListResponse,
    ConversationResponse,
)
from app.schemas.message import (
    AttachmentUrlResponse,
    MessageAttachmentResponse,
    MessageCreate,
    MessageListResponse,
    MessageReadResponse,
    MessageResponse,
    ReportShareRequest,
    ShareableReportItem,
)
from app.services.notification_service import NotificationService
from app.services.report_service import ReportService
from app.services.storage_service import StorageService

logger = logging.getLogger("oravision.services.conversation")


class ConversationService:
    """Domain service managing conversations and messages."""

    @classmethod
    async def _resolve_conversation_response(
        cls,
        db: AsyncSession,
        conv: Conversation,
        current_user_id: uuid.UUID,
    ) -> ConversationResponse:
        """Enrich a Conversation entity with participant names, clinic name, and unread count."""
        # Query patient name
        p_name = None
        stmt_p = (
            select(User.first_name, User.last_name)
            .join(Patient, Patient.user_id == User.id)
            .where(Patient.id == conv.patient_id)
        )
        res_p = await db.execute(stmt_p)
        p_row = res_p.first()
        if p_row:
            p_name = f"{p_row[0]} {p_row[1]}".strip()

        # Query dentist name and clinic
        d_name = None
        clinic_name = None
        stmt_d = (
            select(User.first_name, User.last_name, Dentist.clinic_name)
            .join(Dentist, Dentist.user_id == User.id)
            .where(Dentist.id == conv.dentist_id)
        )
        res_d = await db.execute(stmt_d)
        d_row = res_d.first()
        if d_row:
            d_name = f"Dr. {d_row[0]} {d_row[1]}".strip()
            clinic_name = d_row[2]

        # Calculate unread messages count for current user
        stmt_unread = select(func.count(Message.id)).where(
            and_(
                Message.conversation_id == conv.id,
                Message.sender_id != current_user_id,
                Message.is_read.is_(False),
            )
        )
        res_unread = await db.execute(stmt_unread)
        unread_count = res_unread.scalar() or 0

        return ConversationResponse(
            id=conv.id,
            patient_id=conv.patient_id,
            dentist_id=conv.dentist_id,
            stream_channel_id=conv.stream_channel_id,
            conversation_type=conv.conversation_type,
            is_active=conv.is_active,
            last_message_at=conv.last_message_at,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
            patient_name=p_name,
            dentist_name=d_name,
            clinic_name=clinic_name,
            unread_count=unread_count,
        )

    @classmethod
    def _format_message_response(
        cls,
        msg: Message,
        sender_name: Optional[str] = None,
        sender_role: Optional[str] = None,
    ) -> MessageResponse:
        """Format a Message model into MessageResponse with attachments and shared report metadata."""
        from sqlalchemy import inspect as sa_inspect

        insp = sa_inspect(msg)
        attachments_resp: list[MessageAttachmentResponse] = []
        if "attachments" not in insp.unloaded:
            for att in (msg.attachments or []):
                attachments_resp.append(
                    MessageAttachmentResponse(
                        id=att.id,
                        message_id=att.message_id,
                        original_filename=att.original_filename,
                        mime_type=att.mime_type,
                        file_size=att.file_size,
                        attachment_type=att.attachment_type,
                        created_at=att.created_at,
                    )
                )

        report_id = msg.report_id
        report_number = None
        report_title = None
        if "report" not in insp.unloaded and msg.report:
            report_number = msg.report.report_number
            report_title = msg.report.report_title

        return MessageResponse(
            id=msg.id,
            conversation_id=msg.conversation_id,
            sender_id=msg.sender_id,
            stream_message_id=msg.stream_message_id,
            message_type=msg.message_type,
            content=msg.content,
            attachment_storage_path=msg.attachment_storage_path,
            is_read=msg.is_read,
            read_at=msg.read_at,
            created_at=msg.created_at,
            sender_name=sender_name,
            sender_role=sender_role,
            report_id=report_id,
            report_number=report_number,
            report_title=report_title,
            attachments=attachments_resp,
        )

    @classmethod
    async def create_or_reactivate_for_patient(
        cls,
        db: AsyncSession,
        dentist_id: uuid.UUID,
        user: User,
        data: ConversationCreate,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[ConversationResponse, bool]:
        """Initiate or reactivate a direct conversation thread from an active patient to a target dentist.

        Returns (ConversationResponse, is_created).
        """
        if user.role != "patient":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only active patients can initiate conversations via this route.",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is deactivated or suspended.",
            )

        # 1. Resolve patient
        stmt_p = select(Patient).where(Patient.user_id == user.id)
        res_p = await db.execute(stmt_p)
        patient = res_p.scalar_one_or_none()
        if patient is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient profile not found for authenticated user.",
            )

        # 2. Verify target dentist
        stmt_d = (
            select(Dentist)
            .join(User, Dentist.user_id == User.id)
            .where(
                and_(
                    Dentist.id == dentist_id,
                    Dentist.verification_status == "approved",
                    User.is_active.is_(True),
                )
            )
        )
        res_d = await db.execute(stmt_d)
        dentist = res_d.scalar_one_or_none()
        if dentist is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target dentist not found, inactive, or not approved.",
            )

        # 3. Verify active PatientDentistRelationship (or active appointment)
        stmt_rel = select(PatientDentistRelationship).where(
            and_(
                PatientDentistRelationship.patient_id == patient.id,
                PatientDentistRelationship.dentist_id == dentist.id,
                PatientDentistRelationship.status == "active",
            )
        )
        res_rel = await db.execute(stmt_rel)
        relationship = res_rel.scalar_one_or_none()
        if relationship is None:
            stmt_appt = select(Appointment).where(
                and_(
                    Appointment.patient_id == patient.id,
                    Appointment.dentist_id == dentist.id,
                    Appointment.status.in_(["requested", "confirmed", "in_progress", "completed"]),
                )
            )
            res_appt = await db.execute(stmt_appt)
            appt = res_appt.scalar_one_or_none()
            if appt is not None:
                relationship = PatientDentistRelationship(
                    id=uuid.uuid4(),
                    patient_id=patient.id,
                    dentist_id=dentist.id,
                    status="active",
                    established_via="appointment",
                )
                db.add(relationship)
                await db.commit()
                logger.info(
                    "Auto-established PatientDentistRelationship between patient %s and dentist %s via appointment %s",
                    patient.id,
                    dentist.id,
                    appt.id,
                )
            else:
                logger.warning(
                    "Rejected conversation initiation: no active relationship between patient %s and dentist %s",
                    patient.id,
                    dentist.id,
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Direct conversations require an active patient-dentist relationship.",
                )

        # 4. Check existing conversation
        stmt_conv = select(Conversation).where(
            and_(
                Conversation.patient_id == patient.id,
                Conversation.dentist_id == dentist.id,
                Conversation.conversation_type == "direct",
            )
        )
        res_conv = await db.execute(stmt_conv)
        conv = res_conv.scalar_one_or_none()

        if conv is not None:
            # Reactivate if archived
            if not conv.is_active:
                conv.is_active = True
                conv.updated_at = datetime.datetime.now(datetime.timezone.utc)
                audit = AuditLog(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    action="CONVERSATION_CREATED",
                    resource_type="conversation",
                    resource_id=str(conv.id),
                    ip_address=ip_address,
                    user_agent=user_agent,
                    details={
                        "patient_id": str(patient.id),
                        "dentist_id": str(dentist.id),
                        "conversation_type": "direct",
                        "reactivated": True,
                        "created_by_role": user.role,
                    },
                )
                db.add(audit)
                await db.commit()
                await db.refresh(conv)
                logger.info("Reactivated direct conversation %s between patient %s and dentist %s", conv.id, patient.id, dentist.id)
            resp = await cls._resolve_conversation_response(db, conv, user.id)
            return (resp, False)

        # 5. Create new conversation with server-controlled defaults
        channel_id = f"channel_{uuid.uuid4().hex}"
        now_dt = datetime.datetime.now(datetime.timezone.utc)
        new_conv = Conversation(
            id=uuid.uuid4(),
            patient_id=patient.id,
            dentist_id=dentist.id,
            stream_channel_id=channel_id,
            conversation_type="direct",
            is_active=True,
            last_message_at=None,
            created_at=now_dt,
            updated_at=now_dt,
        )
        db.add(new_conv)

        audit = AuditLog(
            id=uuid.uuid4(),
            user_id=user.id,
            action="CONVERSATION_CREATED",
            resource_type="conversation",
            resource_id=str(new_conv.id),
            ip_address=ip_address,
            user_agent=user_agent,
            details={
                "patient_id": str(patient.id),
                "dentist_id": str(dentist.id),
                "conversation_type": "direct",
                "stream_channel_id": channel_id,
                "created_by_role": user.role,
            },
        )
        db.add(audit)

        try:
            await db.commit()
            await db.refresh(new_conv)
            logger.info("Created new direct conversation %s between patient %s and dentist %s", new_conv.id, patient.id, dentist.id)
        except IntegrityError:
            await db.rollback()
            res_retry = await db.execute(stmt_conv)
            conv_existing = res_retry.scalar_one_or_none()
            if conv_existing is not None:
                if not conv_existing.is_active:
                    conv_existing.is_active = True
                    conv_existing.updated_at = datetime.datetime.now(datetime.timezone.utc)
                    await db.commit()
                    await db.refresh(conv_existing)
                resp = await cls._resolve_conversation_response(db, conv_existing, user.id)
                return (resp, False)
            raise

        resp = await cls._resolve_conversation_response(db, new_conv, user.id)
        return (resp, True)

    @classmethod
    async def create_or_reactivate_for_dentist(
        cls,
        db: AsyncSession,
        patient_id: uuid.UUID,
        user: User,
        data: ConversationCreate,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Tuple[ConversationResponse, bool]:
        """Initiate or reactivate a direct conversation thread from an approved dentist to a target patient.

        Returns (ConversationResponse, is_created).
        """
        if user.role != "dentist":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only approved dentists can initiate conversations via this route.",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is deactivated or suspended.",
            )

        # 1. Resolve dentist
        stmt_d = select(Dentist).where(Dentist.user_id == user.id)
        res_d = await db.execute(stmt_d)
        dentist = res_d.scalar_one_or_none()
        if dentist is None or dentist.verification_status != "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Dentist profile is not approved or inactive.",
            )

        # 2. Verify target patient
        stmt_p = (
            select(Patient)
            .join(User, Patient.user_id == User.id)
            .where(
                and_(
                    Patient.id == patient_id,
                    User.is_active.is_(True),
                )
            )
        )
        res_p = await db.execute(stmt_p)
        patient = res_p.scalar_one_or_none()
        if patient is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target patient not found or inactive.",
            )

        # 3. Verify active PatientDentistRelationship
        stmt_rel = select(PatientDentistRelationship).where(
            and_(
                PatientDentistRelationship.patient_id == patient.id,
                PatientDentistRelationship.dentist_id == dentist.id,
                PatientDentistRelationship.status == "active",
            )
        )
        res_rel = await db.execute(stmt_rel)
        relationship = res_rel.scalar_one_or_none()
        if relationship is None:
            logger.warning(
                "Rejected conversation initiation: no active relationship between dentist %s and patient %s",
                dentist.id,
                patient.id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Direct conversations require an active patient-dentist relationship.",
            )

        # 4. Check existing conversation
        stmt_conv = select(Conversation).where(
            and_(
                Conversation.patient_id == patient.id,
                Conversation.dentist_id == dentist.id,
                Conversation.conversation_type == "direct",
            )
        )
        res_conv = await db.execute(stmt_conv)
        conv = res_conv.scalar_one_or_none()

        if conv is not None:
            if not conv.is_active:
                conv.is_active = True
                conv.updated_at = datetime.datetime.now(datetime.timezone.utc)
                audit = AuditLog(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    action="CONVERSATION_CREATED",
                    resource_type="conversation",
                    resource_id=str(conv.id),
                    ip_address=ip_address,
                    user_agent=user_agent,
                    details={
                        "patient_id": str(patient.id),
                        "dentist_id": str(dentist.id),
                        "conversation_type": "direct",
                        "reactivated": True,
                        "created_by_role": user.role,
                    },
                )
                db.add(audit)
                await db.commit()
                await db.refresh(conv)
                logger.info("Reactivated direct conversation %s between dentist %s and patient %s", conv.id, dentist.id, patient.id)
            resp = await cls._resolve_conversation_response(db, conv, user.id)
            return (resp, False)

        # 5. Create new conversation
        channel_id = f"channel_{uuid.uuid4().hex}"
        now_dt = datetime.datetime.now(datetime.timezone.utc)
        new_conv = Conversation(
            id=uuid.uuid4(),
            patient_id=patient.id,
            dentist_id=dentist.id,
            stream_channel_id=channel_id,
            conversation_type="direct",
            is_active=True,
            last_message_at=None,
            created_at=now_dt,
            updated_at=now_dt,
        )
        db.add(new_conv)

        audit = AuditLog(
            id=uuid.uuid4(),
            user_id=user.id,
            action="CONVERSATION_CREATED",
            resource_type="conversation",
            resource_id=str(new_conv.id),
            ip_address=ip_address,
            user_agent=user_agent,
            details={
                "patient_id": str(patient.id),
                "dentist_id": str(dentist.id),
                "conversation_type": "direct",
                "stream_channel_id": channel_id,
                "created_by_role": user.role,
            },
        )
        db.add(audit)

        try:
            await db.commit()
            await db.refresh(new_conv)
            logger.info("Created new direct conversation %s between dentist %s and patient %s", new_conv.id, dentist.id, patient.id)
        except IntegrityError:
            await db.rollback()
            res_retry = await db.execute(stmt_conv)
            conv_existing = res_retry.scalar_one_or_none()
            if conv_existing is not None:
                if not conv_existing.is_active:
                    conv_existing.is_active = True
                    conv_existing.updated_at = datetime.datetime.now(datetime.timezone.utc)
                    await db.commit()
                    await db.refresh(conv_existing)
                resp = await cls._resolve_conversation_response(db, conv_existing, user.id)
                return (resp, False)
            raise

        resp = await cls._resolve_conversation_response(db, new_conv, user.id)
        return (resp, True)

    @classmethod
    async def get_conversation_by_id(
        cls,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> ConversationResponse:
        """Retrieve a conversation thread with participant authorization."""
        stmt = (
            select(Conversation)
            .options(
                selectinload(Conversation.patient),
                selectinload(Conversation.dentist),
            )
            .where(Conversation.id == conversation_id)
        )
        res = await db.execute(stmt)
        conv = res.scalar_one_or_none()
        if conv is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        # Authorization check
        if user.role == "admin":
            pass  # Admin oversight read-only
        elif user.role == "patient":
            if conv.patient.user_id != user.id:
                logger.warning("Patient %s denied access to conversation %s", user.id, conversation_id)
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access forbidden: you are not a participant in this conversation.",
                )
        elif user.role == "dentist":
            if conv.dentist.user_id != user.id:
                logger.warning("Dentist %s denied access to conversation %s", user.id, conversation_id)
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access forbidden: you are not a participant in this conversation.",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden.",
            )

        audit = AuditLog(
            id=uuid.uuid4(),
            user_id=user.id,
            action="CONVERSATION_VIEWED",
            resource_type="conversation",
            resource_id=str(conv.id),
            ip_address=ip_address,
            user_agent=user_agent,
            details={
                "actor_id": str(user.id),
                "actor_role": user.role,
            },
        )
        db.add(audit)
        await db.commit()

        return await cls._resolve_conversation_response(db, conv, user.id)

    @classmethod
    async def list_conversations(
        cls,
        db: AsyncSession,
        user: User,
        is_active: Optional[bool] = None,
        patient_id: Optional[uuid.UUID] = None,
        dentist_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> ConversationListResponse:
        """List conversations scoped to the authenticated user."""
        conditions = [Conversation.conversation_type == "direct"]

        if is_active is not None:
            conditions.append(Conversation.is_active == is_active)

        if user.role == "patient":
            stmt_p = select(Patient.id).where(Patient.user_id == user.id)
            res_p = await db.execute(stmt_p)
            p_id = res_p.scalar_one_or_none()
            if p_id is None:
                return ConversationListResponse(total=0, items=[])
            conditions.append(Conversation.patient_id == p_id)
        elif user.role == "dentist":
            stmt_d = select(Dentist.id).where(Dentist.user_id == user.id)
            res_d = await db.execute(stmt_d)
            d_id = res_d.scalar_one_or_none()
            if d_id is None:
                return ConversationListResponse(total=0, items=[])
            conditions.append(Conversation.dentist_id == d_id)
        elif user.role == "admin":
            if patient_id is not None:
                conditions.append(Conversation.patient_id == patient_id)
            if dentist_id is not None:
                conditions.append(Conversation.dentist_id == dentist_id)
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden.",
            )

        stmt = (
            select(Conversation)
            .where(and_(*conditions))
            .order_by(
                Conversation.last_message_at.desc().nullslast(),
                Conversation.created_at.desc(),
            )
        )
        res = await db.execute(stmt)
        convs = list(res.scalars().all())

        items = []
        for c in convs:
            items.append(await cls._resolve_conversation_response(db, c, user.id))

        return ConversationListResponse(total=len(items), items=items)

    @classmethod
    async def archive_conversation(
        cls,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        user: User,
        data: ConversationArchive,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> ConversationResponse:
        """Archive a conversation thread (unconditionally set is_active = False)."""
        stmt = (
            select(Conversation)
            .options(
                selectinload(Conversation.patient),
                selectinload(Conversation.dentist),
            )
            .where(Conversation.id == conversation_id)
        )
        res = await db.execute(stmt)
        conv = res.scalar_one_or_none()
        if conv is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        # Authorization check
        if user.role == "admin":
            pass
        elif user.role == "patient":
            if conv.patient.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access forbidden: you are not a participant in this conversation.",
                )
        elif user.role == "dentist":
            if conv.dentist.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access forbidden: you are not a participant in this conversation.",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden.",
            )

        conv.is_active = False
        conv.updated_at = datetime.datetime.now(datetime.timezone.utc)

        audit = AuditLog(
            id=uuid.uuid4(),
            user_id=user.id,
            action="CONVERSATION_ARCHIVED",
            resource_type="conversation",
            resource_id=str(conv.id),
            ip_address=ip_address,
            user_agent=user_agent,
            details={
                "archived_by_id": str(user.id),
                "actor_role": user.role,
            },
        )
        db.add(audit)
        await db.commit()
        await db.refresh(conv)

        logger.info("Conversation %s archived by user %s (%s)", conv.id, user.id, user.role)
        return await cls._resolve_conversation_response(db, conv, user.id)

    @classmethod
    async def send_message(
        cls,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        user: User,
        data: MessageCreate,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> MessageResponse:
        """Send a text message in an active conversation.

        Admins cannot send messages (403 Forbidden).
        Only active participants can send.
        """
        if user.role == "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrators cannot post messages in clinical conversations.",
            )

        stmt = (
            select(Conversation)
            .options(
                selectinload(Conversation.patient),
                selectinload(Conversation.dentist),
            )
            .where(Conversation.id == conversation_id)
        )
        res = await db.execute(stmt)
        conv = res.scalar_one_or_none()
        if conv is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        # Participant check
        is_participant = (
            conv.patient.user_id == user.id or conv.dentist.user_id == user.id
        )
        if not is_participant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: you are not a participant in this conversation.",
            )

        # Active conversation check
        if not conv.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Conversation is archived. New messages cannot be sent.",
            )

        content_clean = data.content.strip()
        if not content_clean:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Message content cannot be empty or whitespace only.",
            )

        now_dt = datetime.datetime.now(datetime.timezone.utc)
        stream_msg_id = f"msg_{uuid.uuid4().hex}"

        new_message = Message(
            id=uuid.uuid4(),
            conversation_id=conv.id,
            sender_id=user.id,
            stream_message_id=stream_msg_id,
            message_type="text",
            content=content_clean,
            attachment_storage_path=None,
            is_read=False,
            read_at=None,
            created_at=now_dt,
        )
        db.add(new_message)

        # Update parent conversation activity timestamp
        conv.last_message_at = now_dt
        conv.updated_at = now_dt

        audit = AuditLog(
            id=uuid.uuid4(),
            user_id=user.id,
            action="MESSAGE_SENT",
            resource_type="message",
            resource_id=str(new_message.id),
            ip_address=ip_address,
            user_agent=user_agent,
            details={
                "conversation_id": str(conv.id),
                "sender_id": str(user.id),
                "message_type": "text",
                "character_count": len(content_clean),
            },
        )
        db.add(audit)

        sender_name = f"{user.first_name} {user.last_name}".strip()
        if user.role == "dentist":
            sender_name = f"Dr. {sender_name}"

        # Atomic Message + Audit + Notification transaction
        try:
            recipient_user_id = conv.dentist.user_id if user.id == conv.patient.user_id else conv.patient.user_id
            await NotificationService.create_notification(
                db=db,
                user_id=recipient_user_id,
                notification_type="new_message",
                title="New Message",
                message=f"{sender_name} sent you a new message.",
                action_url=f"/conversations/{conv.id}",
                suppress_duplicates_window_seconds=2,
            )
            await db.commit()
            await db.refresh(new_message)
        except Exception as exc:
            await db.rollback()
            logger.error("Failed to commit message and notification transaction: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send message and dispatch delivery notification.",
            )

        logger.info("Message %s sent in conversation %s by user %s", new_message.id, conv.id, user.id)
        return cls._format_message_response(new_message, sender_name, user.role)

    @classmethod
    async def list_messages(
        cls,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        user: User,
        limit: int = 50,
        offset: int = 0,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> MessageListResponse:
        """List messages within a conversation with standard limit/offset pagination ordered by created_at ASC."""
        stmt = (
            select(Conversation)
            .options(
                selectinload(Conversation.patient),
                selectinload(Conversation.dentist),
            )
            .where(Conversation.id == conversation_id)
        )
        res = await db.execute(stmt)
        conv = res.scalar_one_or_none()
        if conv is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        # Authorization check
        if user.role == "admin":
            pass  # Admin oversight read-only
        elif user.role == "patient":
            if conv.patient.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access forbidden: you are not a participant in this conversation.",
                )
        elif user.role == "dentist":
            if conv.dentist.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access forbidden: you are not a participant in this conversation.",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden.",
            )

        # Total count
        stmt_count = select(func.count(Message.id)).where(Message.conversation_id == conversation_id)
        res_count = await db.execute(stmt_count)
        total = res_count.scalar() or 0

        # Paginated messages query ordered by created_at ASC
        # Paginated messages query ordered by created_at ASC with eager-loaded attachments & report
        stmt_msgs = (
            select(Message, User.first_name, User.last_name, User.role)
            .join(User, Message.sender_id == User.id)
            .where(Message.conversation_id == conversation_id)
            .options(
                selectinload(Message.attachments),
                selectinload(Message.report),
            )
            .order_by(Message.created_at.asc())
            .offset(offset)
            .limit(limit)
        )
        res_msgs = await db.execute(stmt_msgs)
        rows = res_msgs.all()

        items = []
        for msg, first_name, last_name, sender_role in rows:
            sender_name = f"{first_name} {last_name}".strip()
            if sender_role == "dentist":
                sender_name = f"Dr. {sender_name}"

            items.append(cls._format_message_response(msg, sender_name, sender_role))

        audit = AuditLog(
            id=uuid.uuid4(),
            user_id=user.id,
            action="MESSAGES_VIEWED",
            resource_type="conversation",
            resource_id=str(conv.id),
            ip_address=ip_address,
            user_agent=user_agent,
            details={
                "message_count": len(items),
                "limit": limit,
                "offset": offset,
                "viewer_role": user.role,
            },
        )
        db.add(audit)
        await db.commit()

        return MessageListResponse(
            total=total,
            limit=limit,
            offset=offset,
            items=items,
        )

    @classmethod
    async def get_message_by_id(
        cls,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        message_id: uuid.UUID,
        user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> MessageResponse:
        """Retrieve a specific message within a conversation with authorization check."""
        stmt_conv = (
            select(Conversation)
            .options(
                selectinload(Conversation.patient),
                selectinload(Conversation.dentist),
            )
            .where(Conversation.id == conversation_id)
        )
        res_conv = await db.execute(stmt_conv)
        conv = res_conv.scalar_one_or_none()
        if conv is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        if user.role == "admin":
            pass
        elif user.role == "patient":
            if conv.patient.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access forbidden: you are not a participant in this conversation.",
                )
        elif user.role == "dentist":
            if conv.dentist.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access forbidden: you are not a participant in this conversation.",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden.",
            )

        stmt_msg = (
            select(Message, User.first_name, User.last_name, User.role)
            .join(User, Message.sender_id == User.id)
            .where(
                and_(
                    Message.id == message_id,
                    Message.conversation_id == conversation_id,
                )
            )
            .options(
                selectinload(Message.attachments),
                selectinload(Message.report),
            )
        )
        res_msg = await db.execute(stmt_msg)
        row = res_msg.first()
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found in the specified conversation.",
            )

        msg, first_name, last_name, sender_role = row
        sender_name = f"{first_name} {last_name}".strip()
        if sender_role == "dentist":
            sender_name = f"Dr. {sender_name}"

        return cls._format_message_response(msg, sender_name, sender_role)

    @classmethod
    async def mark_messages_read(
        cls,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> MessageReadResponse:
        """Mark unread incoming messages as read via a single atomic UPDATE statement.

        Admins cannot alter read states (403 Forbidden).
        Senders cannot mark their own messages as read.
        """
        if user.role == "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrators cannot mark clinical conversation messages as read.",
            )

        stmt_conv = (
            select(Conversation)
            .options(
                selectinload(Conversation.patient),
                selectinload(Conversation.dentist),
            )
            .where(Conversation.id == conversation_id)
        )
        res_conv = await db.execute(stmt_conv)
        conv = res_conv.scalar_one_or_none()
        if conv is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        # Participant check
        is_participant = (
            conv.patient.user_id == user.id or conv.dentist.user_id == user.id
        )
        if not is_participant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: you are not a participant in this conversation.",
            )

        now_dt = datetime.datetime.now(datetime.timezone.utc)

        stmt_update = (
            update(Message)
            .where(
                and_(
                    Message.conversation_id == conversation_id,
                    Message.sender_id != user.id,
                    Message.is_read.is_(False),
                )
            )
            .values(
                is_read=True,
                read_at=now_dt,
            )
        )
        res_update = await db.execute(stmt_update)
        marked_count = res_update.rowcount or 0

        audit = AuditLog(
            id=uuid.uuid4(),
            user_id=user.id,
            action="MESSAGES_READ",
            resource_type="conversation",
            resource_id=str(conv.id),
            ip_address=ip_address,
            user_agent=user_agent,
            details={
                "marked_read_count": marked_count,
                "reader_id": str(user.id),
            },
        )
        db.add(audit)
        await db.commit()

        logger.info("Marked %d messages read in conversation %s by reader %s", marked_count, conv.id, user.id)
        return MessageReadResponse(
            marked_read_count=marked_count,
            conversation_id=conversation_id,
        )

    # =========================================================================
    # Phase 34: Chat File Attachments & Report Sharing
    # =========================================================================

    @classmethod
    async def send_message_with_attachments(
        cls,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        user: User,
        files: List[Tuple[str, bytes, str]],  # (original_filename, file_bytes, content_type)
        content: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> MessageResponse:
        """Send a message with one or more file attachments (images or PDFs)."""
        if user.role == "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrators cannot post messages in clinical conversations.",
            )

        stmt = (
            select(Conversation)
            .options(
                selectinload(Conversation.patient),
                selectinload(Conversation.dentist),
            )
            .where(Conversation.id == conversation_id)
        )
        res = await db.execute(stmt)
        conv = res.scalar_one_or_none()
        if conv is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        # Participant check
        is_participant = (
            conv.patient.user_id == user.id or conv.dentist.user_id == user.id
        )
        if not is_participant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: you are not a participant in this conversation.",
            )

        # Active conversation check
        if not conv.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Conversation is archived. New messages cannot be sent.",
            )

        # File count validation (1 to 5)
        if not files or len(files) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one file attachment is required.",
            )
        if len(files) > 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum of 5 attachments allowed per message.",
            )

        # Validate all files before starting uploads
        validated_files = []
        for orig_name, file_bytes, ctype in files:
            try:
                ext, detected_mime, att_type = StorageService.validate_chat_attachment(
                    file_bytes=file_bytes,
                    filename=orig_name,
                    content_type=ctype,
                )
                validated_files.append({
                    "bytes": file_bytes,
                    "filename": orig_name,
                    "content_type": ctype,
                    "detected_mime": detected_mime,
                    "attachment_type": att_type,
                    "ext": ext,
                })
            except ValueError as err:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Attachment validation failed for '{orig_name}': {str(err)}",
                )

        now_dt = datetime.datetime.now(datetime.timezone.utc)
        message_id = uuid.uuid4()

        # Upload files to Supabase Storage
        uploaded_paths: List[str] = []
        attachments_meta = []
        try:
            for v_file in validated_files:
                meta = StorageService.upload_chat_attachment(
                    file_bytes=v_file["bytes"],
                    conversation_id=conv.id,
                    message_id=message_id,
                    original_filename=v_file["filename"],
                    content_type=v_file["content_type"],
                )
                uploaded_paths.append(meta["storage_path"])
                attachments_meta.append(meta)
        except Exception as exc:
            # Storage rollback: delete already uploaded files
            for path in uploaded_paths:
                try:
                    StorageService.delete_file(path)
                except Exception:
                    pass
            logger.error("Failed uploading chat attachment: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload attachment: {str(exc)}",
            )

        # Determine message_type
        if len(attachments_meta) == 1 and attachments_meta[0]["attachment_type"] == "image":
            message_type = "image"
        else:
            message_type = "attachment"

        content_clean = content.strip() if (content and content.strip()) else ""
        first_storage_path = attachments_meta[0]["storage_path"] if attachments_meta else None

        new_message = Message(
            id=message_id,
            conversation_id=conv.id,
            sender_id=user.id,
            stream_message_id=f"msg_{uuid.uuid4().hex}",
            message_type=message_type,
            content=content_clean,
            attachment_storage_path=first_storage_path,
            is_read=False,
            read_at=None,
            created_at=now_dt,
        )
        db.add(new_message)

        # Add MessageAttachment records
        created_attachments = []
        for meta in attachments_meta:
            att = MessageAttachment(
                id=uuid.uuid4(),
                message_id=message_id,
                storage_path=meta["storage_path"],
                original_filename=meta["original_filename"],
                mime_type=meta["mime_type"],
                file_size=meta["file_size"],
                attachment_type=meta["attachment_type"],
                created_at=now_dt,
            )
            db.add(att)
            created_attachments.append(att)

        # Update parent conversation activity timestamp
        conv.last_message_at = now_dt
        conv.updated_at = now_dt

        audit = AuditLog(
            id=uuid.uuid4(),
            user_id=user.id,
            action="MESSAGE_SENT",
            resource_type="message",
            resource_id=str(new_message.id),
            ip_address=ip_address,
            user_agent=user_agent,
            details={
                "conversation_id": str(conv.id),
                "sender_id": str(user.id),
                "message_type": message_type,
                "attachment_count": len(created_attachments),
                "has_caption": bool(content_clean),
            },
        )
        db.add(audit)

        sender_name = f"{user.first_name} {user.last_name}".strip()
        if user.role == "dentist":
            sender_name = f"Dr. {sender_name}"

        # Atomic commit + notification
        try:
            recipient_user_id = conv.dentist.user_id if user.id == conv.patient.user_id else conv.patient.user_id
            await NotificationService.create_notification(
                db=db,
                user_id=recipient_user_id,
                notification_type="new_message",
                title="New Message",
                message=f"{sender_name} sent you an attachment.",
                action_url=f"/conversations/{conv.id}",
                suppress_duplicates_window_seconds=2,
            )
            await db.commit()
        except Exception as exc:
            await db.rollback()
            for path in uploaded_paths:
                try:
                    StorageService.delete_file(path)
                except Exception:
                    pass
            logger.error("Failed to commit message with attachments: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send message with attachments.",
            )

        logger.info(
            "Message %s with %d attachments sent in conversation %s by user %s",
            new_message.id,
            len(created_attachments),
            conv.id,
            user.id,
        )

        attachments_resp = [
            MessageAttachmentResponse(
                id=a.id,
                message_id=a.message_id,
                original_filename=a.original_filename,
                mime_type=a.mime_type,
                file_size=a.file_size,
                attachment_type=a.attachment_type,
                created_at=a.created_at,
            )
            for a in created_attachments
        ]

        return MessageResponse(
            id=new_message.id,
            conversation_id=new_message.conversation_id,
            sender_id=new_message.sender_id,
            stream_message_id=new_message.stream_message_id,
            message_type=new_message.message_type,
            content=new_message.content,
            attachment_storage_path=new_message.attachment_storage_path,
            is_read=new_message.is_read,
            read_at=new_message.read_at,
            created_at=new_message.created_at,
            sender_name=sender_name,
            sender_role=user.role,
            report_id=None,
            report_number=None,
            report_title=None,
            attachments=attachments_resp,
        )

    @classmethod
    async def get_attachment_signed_url(
        cls,
        db: AsyncSession,
        attachment_id: uuid.UUID,
        user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AttachmentUrlResponse:
        """Generate a short-lived (15-min) signed URL for an authorized chat attachment."""
        stmt = (
            select(MessageAttachment)
            .options(
                selectinload(MessageAttachment.message).options(
                    selectinload(Message.conversation).options(
                        selectinload(Conversation.patient),
                        selectinload(Conversation.dentist),
                    )
                )
            )
            .where(MessageAttachment.id == attachment_id)
        )
        res = await db.execute(stmt)
        att = res.scalar_one_or_none()
        if att is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attachment not found.",
            )

        msg = att.message
        conv = msg.conversation

        # Authorization check
        if user.role == "admin":
            pass  # Admin oversight
        elif user.role == "patient":
            if conv.patient.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access forbidden: you are not a participant in this conversation.",
                )
        elif user.role == "dentist":
            if conv.dentist.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access forbidden: you are not a participant in this conversation.",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden.",
            )

        signed_url = StorageService.create_signed_url(att.storage_path, expires_in=900)
        if signed_url is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Storage service is not configured. Cannot generate attachment URL.",
            )

        audit = AuditLog(
            id=uuid.uuid4(),
            user_id=user.id,
            action="ATTACHMENT_ACCESSED",
            resource_type="message_attachment",
            resource_id=str(att.id),
            ip_address=ip_address,
            user_agent=user_agent,
            details={
                "conversation_id": str(conv.id),
                "message_id": str(msg.id),
                "storage_path": att.storage_path,
                "original_filename": att.original_filename,
            },
        )
        db.add(audit)
        await db.commit()

        return AttachmentUrlResponse(
            attachment_id=att.id,
            signed_url=signed_url,
            expires_in=900,
            filename=att.original_filename,
            mime_type=att.mime_type,
        )

    @classmethod
    async def share_report_in_conversation(
        cls,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        user: User,
        data: ReportShareRequest,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> MessageResponse:
        """Share an existing clinical report in an active conversation. Dentist only."""
        if user.role != "dentist":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only clinical practitioners (dentists) can share reports in chat.",
            )

        stmt = (
            select(Conversation)
            .options(
                selectinload(Conversation.patient),
                selectinload(Conversation.dentist),
            )
            .where(Conversation.id == conversation_id)
        )
        res = await db.execute(stmt)
        conv = res.scalar_one_or_none()
        if conv is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        # Dentist participant check
        if conv.dentist.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: you are not the dentist in this conversation.",
            )

        if not conv.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Conversation is archived. Reports cannot be shared.",
            )

        # Fetch target report with screening
        stmt_rep = (
            select(Report)
            .options(selectinload(Report.screening))
            .where(Report.id == data.report_id)
        )
        res_rep = await db.execute(stmt_rep)
        report = res_rep.scalar_one_or_none()
        if report is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clinical report not found.",
            )

        # Verify report belongs to the patient in this conversation thread
        if report.screening.patient_id != conv.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot share a report that belongs to a different patient.",
            )

        # Verify dentist has clinical access to this report
        has_access = await ReportService.verify_user_report_access(db, user, report.screening)
        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Dentist is not authorized to access this report.",
            )

        now_dt = datetime.datetime.now(datetime.timezone.utc)
        note_clean = data.note.strip() if (data.note and data.note.strip()) else ""
        content_text = note_clean if note_clean else f"Shared Clinical Report: {report.report_number}"

        new_message = Message(
            id=uuid.uuid4(),
            conversation_id=conv.id,
            sender_id=user.id,
            report_id=report.id,
            stream_message_id=f"msg_{uuid.uuid4().hex}",
            message_type="report_share",
            content=content_text,
            attachment_storage_path=report.pdf_storage_path,
            is_read=False,
            read_at=None,
            created_at=now_dt,
        )
        db.add(new_message)

        conv.last_message_at = now_dt
        conv.updated_at = now_dt

        audit = AuditLog(
            id=uuid.uuid4(),
            user_id=user.id,
            action="REPORT_SHARED_IN_CHAT",
            resource_type="message",
            resource_id=str(new_message.id),
            ip_address=ip_address,
            user_agent=user_agent,
            details={
                "conversation_id": str(conv.id),
                "report_id": str(report.id),
                "report_number": report.report_number,
                "sender_id": str(user.id),
            },
        )
        db.add(audit)

        sender_name = f"Dr. {user.first_name} {user.last_name}".strip()

        try:
            await NotificationService.create_notification(
                db=db,
                user_id=conv.patient.user_id,
                notification_type="new_message",
                title="Clinical Report Shared",
                message=f"{sender_name} shared clinical report {report.report_number} with you.",
                action_url=f"/conversations/{conv.id}",
                suppress_duplicates_window_seconds=0,
            )
            await db.commit()
        except Exception as exc:
            await db.rollback()
            logger.error("Failed to commit shared report message: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to share clinical report.",
            )

        logger.info("Report %s shared in conversation %s by dentist %s", report.id, conv.id, user.id)

        return MessageResponse(
            id=new_message.id,
            conversation_id=new_message.conversation_id,
            sender_id=new_message.sender_id,
            stream_message_id=new_message.stream_message_id,
            message_type=new_message.message_type,
            content=new_message.content,
            attachment_storage_path=new_message.attachment_storage_path,
            is_read=new_message.is_read,
            read_at=new_message.read_at,
            created_at=new_message.created_at,
            sender_name=sender_name,
            sender_role=user.role,
            report_id=report.id,
            report_number=report.report_number,
            report_title=report.report_title,
            attachments=[],
        )

    @classmethod
    async def get_shareable_reports_for_dentist(
        cls,
        db: AsyncSession,
        conversation_id: uuid.UUID,
        user: User,
    ) -> List[ShareableReportItem]:
        """List reports belonging to the patient in this conversation, authorized for the calling dentist."""
        if user.role != "dentist":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only clinical practitioners (dentists) can view shareable reports.",
            )

        stmt = (
            select(Conversation)
            .options(
                selectinload(Conversation.patient),
                selectinload(Conversation.dentist),
            )
            .where(Conversation.id == conversation_id)
        )
        res = await db.execute(stmt)
        conv = res.scalar_one_or_none()
        if conv is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        if conv.dentist.user_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: you are not the dentist in this conversation.",
            )

        stmt_reps = (
            select(Report)
            .join(Screening, Report.screening_id == Screening.id)
            .where(
                Screening.patient_id == conv.patient_id,
                Screening.is_deleted.is_(False),
            )
            .options(selectinload(Report.screening))
            .order_by(Report.created_at.desc())
        )
        res_reps = await db.execute(stmt_reps)
        reports = res_reps.scalars().all()

        items = []
        for r in reports:
            has_access = await ReportService.verify_user_report_access(db, user, r.screening)
            if has_access:
                items.append(
                    ShareableReportItem(
                        id=r.id,
                        report_number=r.report_number,
                        report_title=r.report_title,
                        created_at=r.created_at,
                        summary=r.summary,
                        screening_id=r.screening_id,
                    )
                )
        return items
