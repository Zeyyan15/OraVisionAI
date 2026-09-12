"""
OraVisionAI — Appointment Domain Service

Encapsulates appointment creation, dentist verification, availability coverage
validation, discrete grid alignment, double-booking prevention, role-based status
lifecycle transitions, cancellations, and immutable audit logging.
"""

from __future__ import annotations

import datetime
import logging
import uuid
from typing import Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.appointment import Appointment
from app.models.audit_log import AuditLog
from app.models.dentist import Dentist
from app.models.dentist_availability import DentistAvailability
from app.models.patient import Patient
from app.models.patient_dentist_relationship import PatientDentistRelationship
from app.models.screening import Screening
from app.models.user import User
from app.schemas.appointment import (
    AppointmentCancel,
    AppointmentCreate,
    AppointmentListResponse,
    AppointmentResponse,
    AppointmentStatusUpdate,
)

logger = logging.getLogger("oravision.services.appointment")

ACTIVE_STATUSES = {"requested", "confirmed", "in_progress"}
TERMINAL_STATUSES = {"completed", "cancelled", "rescheduled", "no_show"}


class AppointmentService:
    """Domain service managing patient-dentist appointment booking and lifecycle."""

    @classmethod
    def _build_appointment_response(cls, appt: Appointment) -> AppointmentResponse:
        """Helper to serialize an Appointment model into AppointmentResponse."""
        p_name = None
        if appt.patient and appt.patient.user:
            p_name = f"{appt.patient.user.first_name} {appt.patient.user.last_name}".strip()

        d_name = None
        clinic_name = None
        if appt.dentist:
            clinic_name = appt.dentist.clinic_name
            if appt.dentist.user:
                d_name = f"Dr. {appt.dentist.user.first_name} {appt.dentist.user.last_name}".strip()

        return AppointmentResponse(
            id=appt.id,
            patient_id=appt.patient_id,
            dentist_id=appt.dentist_id,
            screening_id=appt.screening_id,
            scheduled_start=appt.scheduled_start,
            scheduled_end=appt.scheduled_end,
            appointment_type=appt.appointment_type,
            status=appt.status,
            cancellation_reason=appt.cancellation_reason,
            cancelled_by_id=appt.cancelled_by_id,
            patient_notes=appt.patient_notes,
            dentist_notes=appt.dentist_notes,
            created_at=appt.created_at or datetime.datetime.now(datetime.timezone.utc),
            updated_at=appt.updated_at or datetime.datetime.now(datetime.timezone.utc),
            patient_name=p_name,
            dentist_name=d_name,
            clinic_name=clinic_name,
        )

    @classmethod
    async def create_appointment(
        cls,
        db: AsyncSession,
        dentist_id: uuid.UUID,
        user: User,
        data: AppointmentCreate,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AppointmentResponse:
        """Create an appointment request for the authenticated patient with the target dentist.

        dentist_id is extracted exclusively from the URL path parameter.
        patient_id is derived exclusively from the authenticated user.
        """
        # 1. Verify caller is an active patient
        if user.role != "patient":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only authenticated patients can request appointments.",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive.",
            )

        stmt_p = select(Patient).where(Patient.user_id == user.id)
        res_p = await db.execute(stmt_p)
        patient = res_p.scalar_one_or_none()
        if patient is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient profile not found for authenticated user.",
            )

        # 2. Verify target dentist exists, is active, and is approved
        stmt_d = (
            select(Dentist)
            .join(User, Dentist.user_id == User.id)
            .where(Dentist.id == dentist_id)
            .options(selectinload(Dentist.user))
        )
        res_d = await db.execute(stmt_d)
        dentist = res_d.scalar_one_or_none()

        if dentist is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Target dentist not found.",
            )

        if not dentist.user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Target dentist account is inactive.",
            )

        if dentist.verification_status != "approved":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Dentist verification status is '{dentist.verification_status}'. Appointments can only be booked with approved dentists.",
            )

        # 3. Validate timing
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        if data.scheduled_start <= now_utc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Appointment scheduled_start must be in the future.",
            )

        if data.scheduled_end <= data.scheduled_start:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="scheduled_end must be strictly after scheduled_start.",
            )

        # 4. If screening_id provided, verify patient ownership
        if data.screening_id is not None:
            stmt_s = select(Screening).where(Screening.id == data.screening_id)
            res_s = await db.execute(stmt_s)
            screening = res_s.scalar_one_or_none()
            if screening is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Specified screening not found.",
                )
            if screening.patient_id != patient.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot attach a screening belonging to another patient.",
                )
            if screening.is_deleted:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot attach a deleted screening to an appointment.",
                )

        # 5. Availability Coverage, Slot Duration, and Grid Alignment
        # day_of_week mapping: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        req_day_of_week = (data.scheduled_start.weekday() + 1) % 7

        stmt_avail = select(DentistAvailability).where(
            and_(
                DentistAvailability.dentist_id == dentist.id,
                DentistAvailability.day_of_week == req_day_of_week,
                DentistAvailability.is_active.is_(True),
            )
        )
        res_avail = await db.execute(stmt_avail)
        availabilities = list(res_avail.scalars().all())

        matching_avail: Optional[DentistAvailability] = None
        req_start_time = data.scheduled_start.time()
        req_end_time = data.scheduled_end.time()

        for av in availabilities:
            if av.start_time <= req_start_time and av.end_time >= req_end_time:
                matching_avail = av
                break

        if matching_avail is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Requested appointment time falls outside the dentist's active availability windows for this weekday.",
            )

        # Verify exact slot duration
        duration_minutes = (data.scheduled_end - data.scheduled_start).total_seconds() / 60.0
        if duration_minutes != float(matching_avail.slot_duration_minutes):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Appointment duration ({duration_minutes:.0f} mins) must exactly match the dentist's configured slot duration ({matching_avail.slot_duration_minutes} mins).",
            )

        # Verify discrete slot grid alignment starting from availability.start_time
        start_offset_minutes = (
            (req_start_time.hour * 60 + req_start_time.minute)
            - (matching_avail.start_time.hour * 60 + matching_avail.start_time.minute)
        )
        if (
            start_offset_minutes < 0
            or (start_offset_minutes % matching_avail.slot_duration_minutes) != 0
            or req_start_time.second != 0
            or req_start_time.microsecond != 0
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Appointment start time must align with the discrete {matching_avail.slot_duration_minutes}-minute slot grid for this availability window.",
            )

        # 6. Concurrency-Safe Conflict / Double-Booking Prevention
        # Check Dentist Conflict
        stmt_dentist_conflict = (
            select(Appointment)
            .where(
                and_(
                    Appointment.dentist_id == dentist.id,
                    Appointment.status.in_(ACTIVE_STATUSES),
                    Appointment.scheduled_start < data.scheduled_end,
                    Appointment.scheduled_end > data.scheduled_start,
                )
            )
            .with_for_update()
        )
        res_d_conflict = await db.execute(stmt_dentist_conflict)
        if res_d_conflict.scalars().first() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The selected dentist already has an appointment scheduled during this time window.",
            )

        # Check Patient Conflict
        stmt_patient_conflict = (
            select(Appointment)
            .where(
                and_(
                    Appointment.patient_id == patient.id,
                    Appointment.status.in_(ACTIVE_STATUSES),
                    Appointment.scheduled_start < data.scheduled_end,
                    Appointment.scheduled_end > data.scheduled_start,
                )
            )
            .with_for_update()
        )
        res_p_conflict = await db.execute(stmt_patient_conflict)
        if res_p_conflict.scalars().first() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You already have an appointment scheduled during this time window.",
            )

        # 7. Safe PatientDentistRelationship Reuse / Reactivation / Creation
        stmt_rel = select(PatientDentistRelationship).where(
            and_(
                PatientDentistRelationship.patient_id == patient.id,
                PatientDentistRelationship.dentist_id == dentist.id,
            )
        )
        res_rel = await db.execute(stmt_rel)
        existing_rel = res_rel.scalar_one_or_none()

        if existing_rel is None:
            new_rel = PatientDentistRelationship(
                id=uuid.uuid4(),
                patient_id=patient.id,
                dentist_id=dentist.id,
                status="active",
                established_via="appointment",
            )
            db.add(new_rel)
            logger.info(
                "Created new PatientDentistRelationship between patient %s and dentist %s via appointment",
                patient.id,
                dentist.id,
            )
        elif existing_rel.status != "active":
            existing_rel.status = "active"
            logger.info(
                "Reactivated existing PatientDentistRelationship between patient %s and dentist %s",
                patient.id,
                dentist.id,
            )

        # 8. Persist Appointment
        now_dt = datetime.datetime.now(datetime.timezone.utc)
        appointment = Appointment(
            id=uuid.uuid4(),
            patient_id=patient.id,
            dentist_id=dentist.id,
            screening_id=data.screening_id,
            scheduled_start=data.scheduled_start,
            scheduled_end=data.scheduled_end,
            appointment_type=data.appointment_type,
            status="requested",
            cancellation_reason=None,
            cancelled_by_id=None,
            patient_notes=data.patient_notes,
            dentist_notes=None,
            created_at=now_dt,
            updated_at=now_dt,
        )
        db.add(appointment)

        # 9. Audit Logging
        audit_entry = AuditLog(
            user_id=user.id,
            action="APPOINTMENT_CREATED",
            resource_type="appointment",
            resource_id=str(appointment.id),
            details={
                "patient_id": str(patient.id),
                "dentist_id": str(dentist.id),
                "appointment_type": data.appointment_type,
                "scheduled_start": data.scheduled_start.isoformat(),
                "scheduled_end": data.scheduled_end.isoformat(),
                "status": "requested",
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)

        await db.commit()

        # Reload with relationships for response
        stmt_reload = (
            select(Appointment)
            .where(Appointment.id == appointment.id)
            .options(
                selectinload(Appointment.patient).selectinload(Patient.user),
                selectinload(Appointment.dentist).selectinload(Dentist.user),
            )
        )
        res_reload = await db.execute(stmt_reload)
        appointment = res_reload.scalar_one()

        logger.info(
            "Appointment %s requested by patient %s with dentist %s for %s",
            appointment.id,
            patient.id,
            dentist.id,
            appointment.scheduled_start,
        )

        return cls._build_appointment_response(appointment)

    @classmethod
    async def get_appointment_by_id(
        cls,
        db: AsyncSession,
        appointment_id: uuid.UUID,
        user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AppointmentResponse:
        """Retrieve a specific appointment by ID with role-based ownership enforcement."""
        stmt = (
            select(Appointment)
            .where(Appointment.id == appointment_id)
            .options(
                selectinload(Appointment.patient).selectinload(Patient.user),
                selectinload(Appointment.dentist).selectinload(Dentist.user),
            )
        )
        res = await db.execute(stmt)
        appointment = res.scalar_one_or_none()

        if appointment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Appointment not found.",
            )

        # Enforce role-based ownership
        if user.role == "patient":
            if appointment.patient.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to view another patient's appointment.",
                )
        elif user.role == "dentist":
            if appointment.dentist.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to view another dentist's appointment.",
                )
        elif user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized role.",
            )

        audit_entry = AuditLog(
            user_id=user.id,
            action="APPOINTMENT_VIEWED",
            resource_type="appointment",
            resource_id=str(appointment.id),
            details={
                "viewer_role": user.role,
                "appointment_id": str(appointment.id),
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)
        await db.commit()

        return cls._build_appointment_response(appointment)

    @classmethod
    async def list_appointments(
        cls,
        db: AsyncSession,
        user: User,
        status_filter: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AppointmentListResponse:
        """List appointments filtered by the authenticated user's role and identity."""
        stmt = (
            select(Appointment)
            .options(
                selectinload(Appointment.patient).selectinload(Patient.user),
                selectinload(Appointment.dentist).selectinload(Dentist.user),
            )
            .order_by(Appointment.scheduled_start.desc())
        )

        if user.role == "patient":
            stmt = stmt.join(Patient, Appointment.patient_id == Patient.id).where(
                Patient.user_id == user.id
            )
        elif user.role == "dentist":
            stmt = stmt.join(Dentist, Appointment.dentist_id == Dentist.id).where(
                Dentist.user_id == user.id
            )
        elif user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized role.",
            )

        if status_filter:
            stmt = stmt.where(Appointment.status == status_filter)

        res = await db.execute(stmt)
        items = list(res.scalars().all())

        return AppointmentListResponse(
            items=[cls._build_appointment_response(a) for a in items],
            total=len(items),
        )

    @classmethod
    async def update_appointment_status(
        cls,
        db: AsyncSession,
        appointment_id: uuid.UUID,
        user: User,
        data: AppointmentStatusUpdate,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AppointmentResponse:
        """Update appointment status according to the valid role-based lifecycle matrix."""
        stmt = (
            select(Appointment)
            .where(Appointment.id == appointment_id)
            .options(
                selectinload(Appointment.patient).selectinload(Patient.user),
                selectinload(Appointment.dentist).selectinload(Dentist.user),
            )
        )
        res = await db.execute(stmt)
        appointment = res.scalar_one_or_none()

        if appointment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Appointment not found.",
            )

        # Status changes via this endpoint are restricted to the treating dentist (or admin)
        if user.role == "dentist":
            if appointment.dentist.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only the assigned treating dentist may update appointment status.",
                )
        elif user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Patients cannot directly update appointment lifecycle status. Use the cancellation endpoint instead.",
            )

        curr_status = appointment.status
        new_status = data.status

        # Cannot transition out of terminal states
        if curr_status in TERMINAL_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot change status of an appointment in terminal state '{curr_status}'.",
            )

        # Enforce valid dentist transitions
        valid_transitions = {
            "requested": {"confirmed"},
            "confirmed": {"in_progress", "completed", "rescheduled", "no_show"},
            "in_progress": {"completed"},
        }

        permitted = valid_transitions.get(curr_status, set())
        if new_status not in permitted:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status transition from '{curr_status}' to '{new_status}'. Permitted: {sorted(permitted)}.",
            )

        appointment.status = new_status
        if data.dentist_notes is not None:
            appointment.dentist_notes = data.dentist_notes

        audit_entry = AuditLog(
            user_id=user.id,
            action="APPOINTMENT_STATUS_UPDATED",
            resource_type="appointment",
            resource_id=str(appointment.id),
            details={
                "from_status": curr_status,
                "to_status": new_status,
                "actor_role": user.role,
                "appointment_id": str(appointment.id),
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)

        await db.commit()
        await db.refresh(appointment)

        logger.info(
            "Appointment %s status updated from %s to %s by user %s",
            appointment.id,
            curr_status,
            new_status,
            user.id,
        )

        return cls._build_appointment_response(appointment)

    @classmethod
    async def cancel_appointment(
        cls,
        db: AsyncSession,
        appointment_id: uuid.UUID,
        user: User,
        data: AppointmentCancel,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AppointmentResponse:
        """Cancel an appointment with a mandatory reason by patient, dentist, or admin."""
        stmt = (
            select(Appointment)
            .where(Appointment.id == appointment_id)
            .options(
                selectinload(Appointment.patient).selectinload(Patient.user),
                selectinload(Appointment.dentist).selectinload(Dentist.user),
            )
        )
        res = await db.execute(stmt)
        appointment = res.scalar_one_or_none()

        if appointment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Appointment not found.",
            )

        # Authorization check: must be the booking patient, treating dentist, or admin
        if user.role == "patient":
            if appointment.patient.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to cancel another patient's appointment.",
                )
        elif user.role == "dentist":
            if appointment.dentist.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have permission to cancel another dentist's appointment.",
                )
        elif user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Unauthorized role.",
            )

        curr_status = appointment.status
        if curr_status in TERMINAL_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel an appointment already in terminal state '{curr_status}'.",
            )

        appointment.status = "cancelled"
        appointment.cancellation_reason = data.cancellation_reason
        appointment.cancelled_by_id = user.id

        audit_entry = AuditLog(
            user_id=user.id,
            action="APPOINTMENT_CANCELLED",
            resource_type="appointment",
            resource_id=str(appointment.id),
            details={
                "from_status": curr_status,
                "to_status": "cancelled",
                "cancelled_by_id": str(user.id),
                "actor_role": user.role,
                "cancellation_reason": data.cancellation_reason,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)

        await db.commit()
        await db.refresh(appointment)

        logger.info(
            "Appointment %s cancelled by user %s (role: %s)",
            appointment.id,
            user.id,
            user.role,
        )

        return cls._build_appointment_response(appointment)
