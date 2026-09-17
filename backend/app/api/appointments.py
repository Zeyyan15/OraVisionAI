"""
OraVisionAI — Appointments API Router

Provides endpoints for managing appointment queries, status lifecycle updates,
and cancellations with ownership and multi-role authorization.
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.appointment import (
    AppointmentCancel,
    AppointmentConfirm,
    AppointmentListResponse,
    AppointmentResponse,
    AppointmentStatusUpdate,
)
from app.services.appointment_service import AppointmentService

router = APIRouter(prefix="/appointments", tags=["Appointments"])


@router.get(
    "",
    response_model=AppointmentListResponse,
    summary="List user's appointments",
)
async def list_appointments(
    request: Request,
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by appointment status"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> AppointmentListResponse:
    """Retrieve appointments for the authenticated user.

    Patients see their own booked appointments.
    Dentists see appointments scheduled with them.
    Admins see all appointments (or filtered by query param).
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await AppointmentService.list_appointments(
        db=db,
        user=current_user,
        status_filter=status_filter,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.get(
    "/{appointment_id}",
    response_model=AppointmentResponse,
    summary="Get appointment details",
)
async def get_appointment(
    appointment_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> AppointmentResponse:
    """Retrieve details of a specific appointment.

    Restricted to the booking patient, the assigned dentist, or an administrator.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await AppointmentService.get_appointment_by_id(
        db=db,
        appointment_id=appointment_id,
        user=current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.patch(
    "/{appointment_id}/status",
    response_model=AppointmentResponse,
    summary="Update appointment status",
)
async def update_appointment_status(
    appointment_id: uuid.UUID,
    status_data: AppointmentStatusUpdate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> AppointmentResponse:
    """Update appointment lifecycle status according to the valid transition matrix.

    Restricted to the assigned treating dentist (or admin).
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await AppointmentService.update_appointment_status(
        db=db,
        appointment_id=appointment_id,
        user=current_user,
        data=status_data,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.patch(
    "/{appointment_id}/cancel",
    response_model=AppointmentResponse,
    summary="Cancel appointment",
)
async def cancel_appointment(
    appointment_id: uuid.UUID,
    cancel_data: AppointmentCancel,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> AppointmentResponse:
    """Cancel an appointment with a mandatory cancellation reason.

    Can be initiated by the booking patient, the assigned dentist, or an administrator.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await AppointmentService.cancel_appointment(
        db=db,
        appointment_id=appointment_id,
        user=current_user,
        data=cancel_data,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.post(
    "/{appointment_id}/confirm",
    response_model=AppointmentResponse,
    summary="Confirm requested appointment",
)
async def confirm_appointment(
    appointment_id: uuid.UUID,
    request: Request,
    confirm_data: Optional[AppointmentConfirm] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> AppointmentResponse:
    """Confirm a requested consultation appointment by the assigned dentist.

    Enforces:
    - Caller must be an active dentist (or admin)
    - Dentist must own the appointment
    - Appointment must be currently in 'requested' state (HTTP 409 Conflict if not)
    - Overlap conflict check: ensures no existing confirmed/in-progress appointment
      overlaps with this interval on the dentist's schedule (HTTP 409 Conflict if conflict)
    - Emits in-app notification to the patient.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    notes = confirm_data.dentist_notes if confirm_data else None
    return await AppointmentService.confirm_appointment(
        db=db,
        appointment_id=appointment_id,
        user=current_user,
        dentist_notes=notes,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.post(
    "/{appointment_id}/reject",
    response_model=AppointmentResponse,
    summary="Reject requested appointment",
)
async def reject_appointment(
    appointment_id: uuid.UUID,
    reject_data: AppointmentCancel,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> AppointmentResponse:
    """Reject a requested consultation appointment with a mandatory cancellation reason.

    Enforces:
    - Caller must be an active dentist (or admin)
    - Dentist must own the appointment
    - Appointment must be currently in 'requested' state (HTTP 409 Conflict if not)
    - Status transitions to 'cancelled' with cancellation_reason recorded
    - Emits in-app notification to the patient.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await AppointmentService.reject_appointment(
        db=db,
        appointment_id=appointment_id,
        user=current_user,
        data=reject_data,
        ip_address=ip_address,
        user_agent=user_agent,
    )

