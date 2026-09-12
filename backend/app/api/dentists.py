"""
OraVisionAI — Dentist API Endpoints

Provides endpoints for dentist professional profiles and credential verification submissions.
Restricted exclusively to authenticated users in the dentist role.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user, require_dentist, require_patient
from app.db.session import get_db
from app.models.user import User
from app.schemas.appointment import AppointmentCreate, AppointmentResponse
from app.schemas.dentist import (
    DentistResponse,
    DentistUpdate,
    DentistVerificationCreate,
    DentistVerificationResponse,
)
from app.schemas.dentist_availability import (
    DentistAvailabilityCreate,
    DentistAvailabilityListResponse,
    DentistAvailabilityResponse,
    DentistAvailabilityUpdate,
)
from app.services.appointment_service import AppointmentService
from app.services.dentist_availability_service import DentistAvailabilityService
from app.services.dentist_service import DentistService

router = APIRouter(prefix="/dentists", tags=["Dentists"])


def _build_dentist_response(user: User, dentist) -> DentistResponse:
    return DentistResponse(
        id=dentist.id,
        user_id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        phone_number=user.phone_number,
        avatar_url=user.avatar_url,
        license_number=dentist.license_number,
        specialization=dentist.specialization,
        clinic_name=dentist.clinic_name,
        clinic_address=dentist.clinic_address,
        years_of_experience=dentist.years_of_experience,
        bio=dentist.bio,
        verification_status=dentist.verification_status,
        verified_at=dentist.verified_at,
        rejection_reason=dentist.rejection_reason,
        created_at=dentist.created_at,
        updated_at=dentist.updated_at,
    )


@router.get("/me", response_model=DentistResponse)
async def get_my_dentist_profile(
    current_user: User = Depends(require_dentist),
    db: AsyncSession = Depends(get_db),
) -> DentistResponse:
    dentist = await DentistService.get_or_create_dentist(db, current_user)
    return _build_dentist_response(current_user, dentist)


@router.patch("/me", response_model=DentistResponse)
async def update_my_dentist_profile(
    update_data: DentistUpdate,
    current_user: User = Depends(require_dentist),
    db: AsyncSession = Depends(get_db),
) -> DentistResponse:
    dentist = await DentistService.get_or_create_dentist(db, current_user)
    updated_dentist = await DentistService.update_dentist_profile(
        db=db,
        dentist=dentist,
        update_data=update_data,
        user=current_user,
    )
    return _build_dentist_response(current_user, updated_dentist)


@router.get("/me/verification", response_model=DentistVerificationResponse)
async def get_my_verification_status(
    current_user: User = Depends(require_dentist),
    db: AsyncSession = Depends(get_db),
) -> DentistVerificationResponse:
    dentist = await DentistService.get_or_create_dentist(db, current_user)
    verification = await DentistService.get_latest_verification(db, dentist.id)
    if verification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No verification record found for this dentist.",
        )
    return verification


@router.post(
    "/me/verification",
    response_model=DentistVerificationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_my_verification(
    create_data: DentistVerificationCreate,
    current_user: User = Depends(require_dentist),
    db: AsyncSession = Depends(get_db),
) -> DentistVerificationResponse:
    dentist = await DentistService.get_or_create_dentist(db, current_user)
    try:
        verification = await DentistService.submit_verification(
            db=db,
            dentist=dentist,
            create_data=create_data,
        )
        return verification
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )


# =============================================================================
# Phase 14: Dentist Availability Endpoints
# =============================================================================


@router.post(
    "/me/availability",
    response_model=DentistAvailabilityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create availability window",
)
async def create_my_availability(
    create_data: DentistAvailabilityCreate,
    request: Request,
    current_user: User = Depends(require_dentist),
    db: AsyncSession = Depends(get_db),
) -> DentistAvailabilityResponse:
    """Create a weekly recurring consultation window for the authenticated approved dentist."""
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await DentistAvailabilityService.create_availability(
        db=db,
        user=current_user,
        data=create_data,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.get(
    "/me/availability",
    response_model=DentistAvailabilityListResponse,
    summary="List dentist's own availability windows",
)
async def list_my_availability(
    request: Request,
    current_user: User = Depends(require_dentist),
    db: AsyncSession = Depends(get_db),
) -> DentistAvailabilityListResponse:
    """List all configured availability windows (active and inactive) for the authenticated dentist."""
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await DentistAvailabilityService.list_my_availabilities(
        db=db,
        user=current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.patch(
    "/me/availability/{availability_id}",
    response_model=DentistAvailabilityResponse,
    summary="Update dentist's availability window",
)
async def update_my_availability(
    availability_id: uuid.UUID,
    update_data: DentistAvailabilityUpdate,
    request: Request,
    current_user: User = Depends(require_dentist),
    db: AsyncSession = Depends(get_db),
) -> DentistAvailabilityResponse:
    """Update an existing availability window owned by the authenticated dentist."""
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await DentistAvailabilityService.update_availability(
        db=db,
        availability_id=availability_id,
        user=current_user,
        data=update_data,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.delete(
    "/me/availability/{availability_id}",
    summary="Delete dentist's availability window",
)
async def delete_my_availability(
    availability_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_dentist),
    db: AsyncSession = Depends(get_db),
):
    """Delete an existing availability window owned by the authenticated dentist."""
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await DentistAvailabilityService.delete_availability(
        db=db,
        availability_id=availability_id,
        user=current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )


@router.get(
    "/{dentist_id}/availability",
    response_model=DentistAvailabilityListResponse,
    summary="Discover approved dentist's active availability windows",
)
async def get_dentist_public_availability(
    dentist_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> DentistAvailabilityListResponse:
    """Public/patient discovery of active consultation availability windows for an approved dentist."""
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await DentistAvailabilityService.list_dentist_public_availabilities(
        db=db,
        dentist_id=dentist_id,
        user=current_user,
        ip_address=ip_address,
        user_agent=user_agent,
    )


# =============================================================================
# Phase 14: Appointment Booking Endpoint (under dentist resource path)
# =============================================================================


@router.post(
    "/{dentist_id}/appointments",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Request/book an appointment with a dentist",
)
async def book_appointment_with_dentist(
    dentist_id: uuid.UUID,
    booking_data: AppointmentCreate,
    request: Request,
    current_user: User = Depends(require_patient),
    db: AsyncSession = Depends(get_db),
) -> AppointmentResponse:
    """Book/request an appointment with the specified dentist.

    dentist_id is extracted exclusively from the URL path.
    patient_id is derived exclusively from the authenticated patient.
    """
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await AppointmentService.create_appointment(
        db=db,
        dentist_id=dentist_id,
        user=current_user,
        data=booking_data,
        ip_address=ip_address,
        user_agent=user_agent,
    )

