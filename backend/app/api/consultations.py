"""
OraVisionAI — Consultations API Router

Provides REST endpoints for teleconsultation session creation, queries,
and role-authorized lifecycle state transitions (start, end, fail).
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.consultation import (
    ConsultationCreate,
    ConsultationEnd,
    ConsultationFail,
    ConsultationListResponse,
    ConsultationResponse,
    ConsultationStart,
)
from app.services.consultation_service import ConsultationService

router = APIRouter(tags=["Consultations"])


# =============================================================================
# Appointment-Linked Consultation Endpoints
# =============================================================================


@router.post(
    "/appointments/{appointment_id}/consultation",
    response_model=ConsultationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Initialize consultation session for appointment",
)
async def create_consultation_for_appointment(
    appointment_id: uuid.UUID,
    data: ConsultationCreate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ConsultationResponse:
    """Initialize a teleconsultation session container for a confirmed appointment.

    Restricted to the assigned treating dentist (or admin).
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await ConsultationService.create_consultation(
        db=db,
        appointment_id=appointment_id,
        user=current_user,
        data=data,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.get(
    "/appointments/{appointment_id}/consultation",
    response_model=ConsultationResponse,
    summary="Get consultation session for appointment",
)
async def get_consultation_for_appointment(
    appointment_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ConsultationResponse:
    """Retrieve the consultation session associated with an appointment.

    Restricted to the booking patient, assigned dentist, or admin.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await ConsultationService.get_consultation_by_appointment(
        db=db,
        appointment_id=appointment_id,
        user=current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )


# =============================================================================
# Consultation Resource Endpoints
# =============================================================================


@router.get(
    "/consultations",
    response_model=ConsultationListResponse,
    summary="List consultation sessions",
)
async def list_consultations(
    request: Request,
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by consultation session status"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ConsultationListResponse:
    """List consultation sessions scoped to the authenticated user's role.

    Patients see their own consultations.
    Dentists see consultations assigned to them.
    Admins see all consultations.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await ConsultationService.list_consultations(
        db=db,
        user=current_user,
        status_filter=status_filter,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.get(
    "/consultations/{consultation_id}",
    response_model=ConsultationResponse,
    summary="Get consultation session details",
)
async def get_consultation(
    consultation_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ConsultationResponse:
    """Retrieve details of a specific consultation session.

    Restricted to the booking patient, assigned dentist, or admin.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await ConsultationService.get_consultation_by_id(
        db=db,
        consultation_id=consultation_id,
        user=current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.patch(
    "/consultations/{consultation_id}/start",
    response_model=ConsultationResponse,
    summary="Start teleconsultation session",
)
async def start_consultation(
    consultation_id: uuid.UUID,
    data: ConsultationStart,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ConsultationResponse:
    """Start an active teleconsultation session (scheduled -> active).

    Restricted to the assigned treating dentist (or admin).
    Synchronizes underlying appointment status from 'confirmed' to 'in_progress'.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await ConsultationService.start_consultation(
        db=db,
        consultation_id=consultation_id,
        user=current_user,
        data=data,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.patch(
    "/consultations/{consultation_id}/end",
    response_model=ConsultationResponse,
    summary="End teleconsultation session",
)
async def end_consultation(
    consultation_id: uuid.UUID,
    data: ConsultationEnd,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ConsultationResponse:
    """Conclude an active teleconsultation session (active -> ended).

    Restricted to the assigned treating dentist (or admin).
    Calculates elapsed duration_seconds and synchronizes appointment status to 'completed'.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await ConsultationService.end_consultation(
        db=db,
        consultation_id=consultation_id,
        user=current_user,
        data=data,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.patch(
    "/consultations/{consultation_id}/fail",
    response_model=ConsultationResponse,
    summary="Mark teleconsultation session as failed",
)
async def fail_consultation(
    consultation_id: uuid.UUID,
    data: ConsultationFail,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> ConsultationResponse:
    """Mark a teleconsultation session as failed (scheduled/active -> failed).

    Patients may fail a session only from 'scheduled' status.
    Dentists and admins may fail a session from 'scheduled' or 'active'.
    Does NOT alter underlying appointment status.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await ConsultationService.fail_consultation(
        db=db,
        consultation_id=consultation_id,
        user=current_user,
        data=data,
        ip_address=ip_address,
        user_agent=user_agent,
    )
