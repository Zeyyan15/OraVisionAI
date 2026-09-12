"""
OraVisionAI — Consultation Domain Service

Encapsulates teleconsultation session creation, participant authorization,
lifecycle state machine transitions, discrete duration calculations,
Phase 14 appointment status synchronization, and immutable audit logging.
"""

from __future__ import annotations

import datetime
import logging
import uuid
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.appointment import Appointment
from app.models.audit_log import AuditLog
from app.models.consultation import Consultation
from app.models.dentist import Dentist
from app.models.patient import Patient
from app.models.user import User
from app.schemas.appointment import AppointmentStatusUpdate
from app.schemas.consultation import (
    ConsultationCreate,
    ConsultationEnd,
    ConsultationFail,
    ConsultationListResponse,
    ConsultationResponse,
    ConsultationStart,
)
from app.services.appointment_service import AppointmentService

logger = logging.getLogger("oravision.services.consultation")

TERMINAL_SESSION_STATUSES = {"ended", "failed"}


class ConsultationService:
    """Domain service managing teleconsultation sessions and lifecycle."""

    @classmethod
    def _build_consultation_response(cls, cons: Consultation) -> ConsultationResponse:
        """Helper to serialize a Consultation model into ConsultationResponse."""
        p_name = None
        if cons.patient and cons.patient.user:
            p_name = f"{cons.patient.user.first_name} {cons.patient.user.last_name}".strip()

        d_name = None
        clinic_name = None
        if cons.dentist:
            clinic_name = cons.dentist.clinic_name
            if cons.dentist.user:
                d_name = f"Dr. {cons.dentist.user.first_name} {cons.dentist.user.last_name}".strip()

        sched_start = None
        sched_end = None
        if cons.appointment:
            sched_start = cons.appointment.scheduled_start
            sched_end = cons.appointment.scheduled_end

        now_utc = datetime.datetime.now(datetime.timezone.utc)
        return ConsultationResponse(
            id=cons.id,
            appointment_id=cons.appointment_id,
            patient_id=cons.patient_id,
            dentist_id=cons.dentist_id,
            stream_call_id=cons.stream_call_id,
            stream_channel_id=cons.stream_channel_id,
            consultation_type=cons.consultation_type,
            session_status=cons.session_status,
            started_at=cons.started_at,
            ended_at=cons.ended_at,
            duration_seconds=cons.duration_seconds,
            clinical_summary=cons.clinical_summary,
            created_at=cons.created_at or now_utc,
            updated_at=cons.updated_at or now_utc,
            patient_name=p_name,
            dentist_name=d_name,
            clinic_name=clinic_name,
            scheduled_start=sched_start,
            scheduled_end=sched_end,
        )

    @classmethod
    async def create_consultation(
        cls,
        db: AsyncSession,
        appointment_id: uuid.UUID,
        user: User,
        data: ConsultationCreate,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> ConsultationResponse:
        """Initialize a teleconsultation session container for a confirmed appointment.

        Only the assigned treating dentist (or admin) can initialize the session.
        Server-generates reserved Stream identifiers and derives participant identities.
        """
        # 1. Fetch appointment with relations
        stmt = (
            select(Appointment)
            .where(Appointment.id == appointment_id)
            .options(
                selectinload(Appointment.dentist).selectinload(Dentist.user),
                selectinload(Appointment.patient).selectinload(Patient.user),
                selectinload(Appointment.consultation),
            )
        )
        res = await db.execute(stmt)
        appointment = res.scalar_one_or_none()

        if appointment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Appointment not found.",
            )

        # 2. Authorization: treating dentist or admin
        if user.role == "dentist":
            if appointment.dentist.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the assigned treating dentist can initialize a consultation for this appointment.",
                )
            if appointment.dentist.verification_status != "approved":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only approved dentists can initialize consultations.",
                )
        elif user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Patients are not authorized to initialize consultation sessions.",
            )

        # 3. Validate appointment status: must be 'confirmed'
        if appointment.status != "confirmed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Consultation can only be initialized for confirmed appointments. Current appointment status is '{appointment.status}'.",
            )

        # 4. Check 1-to-1 uniqueness: no duplicate consultation
        if appointment.consultation is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A consultation session has already been initialized for this appointment.",
            )

        # 5. Server-generate identifiers reserved for future Stream integration
        stream_call_id = f"call_{uuid.uuid4().hex}"
        stream_channel_id = f"channel_{uuid.uuid4().hex}"
        now_utc = datetime.datetime.now(datetime.timezone.utc)

        consultation = Consultation(
            id=uuid.uuid4(),
            appointment_id=appointment.id,
            patient_id=appointment.patient_id,
            dentist_id=appointment.dentist_id,
            stream_call_id=stream_call_id,
            stream_channel_id=stream_channel_id,
            consultation_type=data.consultation_type,
            session_status="scheduled",
            started_at=None,
            ended_at=None,
            duration_seconds=0,
            clinical_summary=None,
            created_at=now_utc,
            updated_at=now_utc,
        )
        db.add(consultation)

        # 6. Audit log
        audit_entry = AuditLog(
            user_id=user.id,
            action="CONSULTATION_CREATED",
            resource_type="consultation",
            resource_id=str(consultation.id),
            details={
                "appointment_id": str(appointment.id),
                "patient_id": str(consultation.patient_id),
                "dentist_id": str(consultation.dentist_id),
                "consultation_type": consultation.consultation_type,
                "session_status": "scheduled",
                "stream_call_id": stream_call_id,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)

        await db.commit()

        # Reload with relations
        stmt_reload = (
            select(Consultation)
            .where(Consultation.id == consultation.id)
            .options(
                selectinload(Consultation.patient).selectinload(Patient.user),
                selectinload(Consultation.dentist).selectinload(Dentist.user),
                selectinload(Consultation.appointment),
            )
        )
        res_reload = await db.execute(stmt_reload)
        consultation = res_reload.scalar_one()

        logger.info(
            "Consultation %s created for appointment %s by user %s",
            consultation.id,
            appointment.id,
            user.id,
        )

        return cls._build_consultation_response(consultation)

    @classmethod
    async def get_consultation_by_id(
        cls,
        db: AsyncSession,
        consultation_id: uuid.UUID,
        user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> ConsultationResponse:
        """Retrieve details of a specific consultation session with ownership verification."""
        stmt = (
            select(Consultation)
            .where(Consultation.id == consultation_id)
            .options(
                selectinload(Consultation.patient).selectinload(Patient.user),
                selectinload(Consultation.dentist).selectinload(Dentist.user),
                selectinload(Consultation.appointment),
            )
        )
        res = await db.execute(stmt)
        consultation = res.scalar_one_or_none()

        if consultation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Consultation not found.",
            )

        # Enforce role-based participant ownership
        if user.role == "patient":
            if consultation.patient.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to view another patient's consultation.",
                )
        elif user.role == "dentist":
            if consultation.dentist.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to view another dentist's consultation.",
                )
        elif user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized role.",
            )

        audit_entry = AuditLog(
            user_id=user.id,
            action="CONSULTATION_VIEWED",
            resource_type="consultation",
            resource_id=str(consultation.id),
            details={
                "viewer_role": user.role,
                "consultation_id": str(consultation.id),
                "appointment_id": str(consultation.appointment_id),
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)
        await db.commit()

        return cls._build_consultation_response(consultation)

    @classmethod
    async def get_consultation_by_appointment(
        cls,
        db: AsyncSession,
        appointment_id: uuid.UUID,
        user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> ConsultationResponse:
        """Retrieve the consultation linked to an appointment with participant authorization."""
        stmt = (
            select(Consultation)
            .where(Consultation.appointment_id == appointment_id)
            .options(
                selectinload(Consultation.patient).selectinload(Patient.user),
                selectinload(Consultation.dentist).selectinload(Dentist.user),
                selectinload(Consultation.appointment),
            )
        )
        res = await db.execute(stmt)
        consultation = res.scalar_one_or_none()

        if consultation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No consultation found for the specified appointment.",
            )

        # Enforce participant ownership
        if user.role == "patient":
            if consultation.patient.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to view this consultation.",
                )
        elif user.role == "dentist":
            if consultation.dentist.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to view this consultation.",
                )
        elif user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized role.",
            )

        audit_entry = AuditLog(
            user_id=user.id,
            action="CONSULTATION_VIEWED",
            resource_type="consultation",
            resource_id=str(consultation.id),
            details={
                "viewer_role": user.role,
                "consultation_id": str(consultation.id),
                "appointment_id": str(consultation.appointment_id),
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)
        await db.commit()

        return cls._build_consultation_response(consultation)

    @classmethod
    async def list_consultations(
        cls,
        db: AsyncSession,
        user: User,
        status_filter: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> ConsultationListResponse:
        """List consultation sessions scoped to the authenticated user's role."""
        stmt = (
            select(Consultation)
            .options(
                selectinload(Consultation.patient).selectinload(Patient.user),
                selectinload(Consultation.dentist).selectinload(Dentist.user),
                selectinload(Consultation.appointment),
            )
            .order_by(Consultation.created_at.desc())
        )

        if user.role == "patient":
            stmt = stmt.join(Patient, Consultation.patient_id == Patient.id).where(
                Patient.user_id == user.id
            )
        elif user.role == "dentist":
            stmt = stmt.join(Dentist, Consultation.dentist_id == Dentist.id).where(
                Dentist.user_id == user.id
            )
        elif user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized role.",
            )

        if status_filter:
            stmt = stmt.where(Consultation.session_status == status_filter)

        res = await db.execute(stmt)
        items = list(res.scalars().all())

        return ConsultationListResponse(
            items=[cls._build_consultation_response(c) for c in items],
            total=len(items),
        )

    @classmethod
    async def start_consultation(
        cls,
        db: AsyncSession,
        consultation_id: uuid.UUID,
        user: User,
        data: ConsultationStart,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> ConsultationResponse:
        """Start an active teleconsultation session.

        Restricted to the assigned treating dentist (or admin).
        Synchronizes appointment status from 'confirmed' to 'in_progress' via AppointmentService.
        """
        stmt = (
            select(Consultation)
            .where(Consultation.id == consultation_id)
            .options(
                selectinload(Consultation.patient).selectinload(Patient.user),
                selectinload(Consultation.dentist).selectinload(Dentist.user),
                selectinload(Consultation.appointment),
            )
        )
        res = await db.execute(stmt)
        consultation = res.scalar_one_or_none()

        if consultation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Consultation not found.",
            )

        # Authorization: treating dentist or admin
        if user.role == "dentist":
            if consultation.dentist.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the assigned treating dentist can start this consultation.",
                )
        elif user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Patients are not authorized to start teleconsultation sessions.",
            )

        # State check
        if consultation.session_status != "scheduled":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot start a consultation in status '{consultation.session_status}'. Must be 'scheduled'.",
            )

        # Check underlying appointment status
        if consultation.appointment.status != "confirmed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Underlying appointment must be 'confirmed' to start consultation. Current: '{consultation.appointment.status}'.",
            )

        # Transactionally synchronize appointment status: confirmed -> in_progress
        await AppointmentService.update_appointment_status(
            db=db,
            appointment_id=consultation.appointment_id,
            user=user,
            data=AppointmentStatusUpdate(status="in_progress"),
            ip_address=ip_address,
            user_agent=user_agent,
        )

        now_utc = datetime.datetime.now(datetime.timezone.utc)
        consultation.session_status = "active"
        consultation.started_at = now_utc
        consultation.updated_at = now_utc

        audit_entry = AuditLog(
            user_id=user.id,
            action="CONSULTATION_STARTED",
            resource_type="consultation",
            resource_id=str(consultation.id),
            details={
                "appointment_id": str(consultation.appointment_id),
                "session_status": "active",
                "started_at": now_utc.isoformat(),
                "actor_role": user.role,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)

        await db.commit()
        await db.refresh(consultation)

        logger.info("Consultation %s started by user %s", consultation.id, user.id)
        return cls._build_consultation_response(consultation)

    @classmethod
    async def end_consultation(
        cls,
        db: AsyncSession,
        consultation_id: uuid.UUID,
        user: User,
        data: ConsultationEnd,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> ConsultationResponse:
        """Conclude an active teleconsultation session.

        Restricted to the assigned treating dentist (or admin).
        Calculates duration_seconds and synchronizes appointment status to 'completed'.
        """
        stmt = (
            select(Consultation)
            .where(Consultation.id == consultation_id)
            .options(
                selectinload(Consultation.patient).selectinload(Patient.user),
                selectinload(Consultation.dentist).selectinload(Dentist.user),
                selectinload(Consultation.appointment),
            )
        )
        res = await db.execute(stmt)
        consultation = res.scalar_one_or_none()

        if consultation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Consultation not found.",
            )

        # Authorization: treating dentist or admin
        if user.role == "dentist":
            if consultation.dentist.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the assigned treating dentist can end this consultation.",
                )
        elif user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Patients are not authorized to end teleconsultation sessions.",
            )

        # State check
        if consultation.session_status != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot end a consultation in status '{consultation.session_status}'. Must be 'active'.",
            )

        # Check underlying appointment status
        if consultation.appointment.status != "in_progress":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Underlying appointment must be 'in_progress' to complete consultation. Current: '{consultation.appointment.status}'.",
            )

        now_utc = datetime.datetime.now(datetime.timezone.utc)
        dur = 0
        if consultation.started_at:
            dur = max(0, int((now_utc - consultation.started_at).total_seconds()))

        consultation.session_status = "ended"
        consultation.ended_at = now_utc
        consultation.duration_seconds = dur
        consultation.updated_at = now_utc
        if data.clinical_summary is not None:
            consultation.clinical_summary = data.clinical_summary

        # Transactionally synchronize appointment status: in_progress -> completed
        await AppointmentService.update_appointment_status(
            db=db,
            appointment_id=consultation.appointment_id,
            user=user,
            data=AppointmentStatusUpdate(status="completed", dentist_notes=data.clinical_summary),
            ip_address=ip_address,
            user_agent=user_agent,
        )

        audit_entry = AuditLog(
            user_id=user.id,
            action="CONSULTATION_COMPLETED",
            resource_type="consultation",
            resource_id=str(consultation.id),
            details={
                "appointment_id": str(consultation.appointment_id),
                "session_status": "ended",
                "duration_seconds": dur,
                "actor_role": user.role,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)

        await db.commit()
        await db.refresh(consultation)

        logger.info("Consultation %s ended by user %s (duration: %ds)", consultation.id, user.id, dur)
        return cls._build_consultation_response(consultation)

    @classmethod
    async def fail_consultation(
        cls,
        db: AsyncSession,
        consultation_id: uuid.UUID,
        user: User,
        data: ConsultationFail,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> ConsultationResponse:
        """Mark a teleconsultation session as failed.

        Permissions:
        - Patient: Permitted for 'scheduled' -> 'failed' ONLY.
                   Forbidden (403) for 'active' -> 'failed'.
        - Treating Dentist: Permitted for 'scheduled' -> 'failed' and 'active' -> 'failed'.
        - Admin: Permitted for 'scheduled' -> 'failed' and 'active' -> 'failed'.

        NOTE: Does NOT alter Appointment.status. The consultation failure state
        remains an independent terminal consultation state.
        """
        stmt = (
            select(Consultation)
            .where(Consultation.id == consultation_id)
            .options(
                selectinload(Consultation.patient).selectinload(Patient.user),
                selectinload(Consultation.dentist).selectinload(Dentist.user),
                selectinload(Consultation.appointment),
            )
        )
        res = await db.execute(stmt)
        consultation = res.scalar_one_or_none()

        if consultation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Consultation not found.",
            )

        # Authorization and state transition validation
        curr_status = consultation.session_status

        if curr_status in TERMINAL_SESSION_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot mark consultation as failed from terminal state '{curr_status}'.",
            )

        if user.role == "patient":
            if consultation.patient.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to modify this consultation.",
                )
            if curr_status != "scheduled":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Patients are not authorized to mark an active consultation as failed.",
                )
        elif user.role == "dentist":
            if consultation.dentist.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the assigned treating dentist can modify this consultation.",
                )
        elif user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized role.",
            )

        now_utc = datetime.datetime.now(datetime.timezone.utc)
        dur = 0
        if curr_status == "active" and consultation.started_at:
            dur = max(0, int((now_utc - consultation.started_at).total_seconds()))

        consultation.session_status = "failed"
        consultation.ended_at = now_utc
        consultation.duration_seconds = dur
        consultation.updated_at = now_utc

        # Appointment.status is NOT modified on consultation failure.
        audit_entry = AuditLog(
            user_id=user.id,
            action="CONSULTATION_FAILED",
            resource_type="consultation",
            resource_id=str(consultation.id),
            details={
                "appointment_id": str(consultation.appointment_id),
                "from_status": curr_status,
                "to_status": "failed",
                "actor_role": user.role,
                "duration_seconds": dur,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)

        await db.commit()
        await db.refresh(consultation)

        logger.info(
            "Consultation %s marked as failed from %s by user %s",
            consultation.id,
            curr_status,
            user.id,
        )
        return cls._build_consultation_response(consultation)
