"""
OraVisionAI — Dentist API Endpoints

Provides endpoints for dentist professional profiles and credential verification submissions.
Restricted exclusively to authenticated users in the dentist role.
"""

import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user, require_dentist, require_patient
from app.db.session import get_db
from app.models.appointment import Appointment
from app.models.dentist import Dentist
from app.models.dentist_assessment import DentistAssessment
from app.models.patient import Patient
from app.models.patient_dentist_relationship import PatientDentistRelationship
from app.models.screening import Screening
from app.models.user import User
from app.schemas.appointment import AppointmentCreate, AppointmentResponse
from app.schemas.dentist import (
    DentistResponse,
    DentistUpdate,
    DentistVerificationCreate,
    DentistVerificationResponse,
)
from app.schemas.dentist_assessment import DentistPendingReviewListResponse
from app.schemas.dentist_availability import (
    DentistAvailabilityCreate,
    DentistAvailabilityListResponse,
    DentistAvailabilityResponse,
    DentistAvailabilityUpdate,
)
from app.schemas.dentist_case import (
    DentistPatientCaseItem,
    DentistPatientCaseListResponse,
)
from app.services.appointment_service import AppointmentService
from app.services.dentist_assessment_service import DentistAssessmentService
from app.services.dentist_availability_service import DentistAvailabilityService
from app.services.dentist_service import DentistService
from sqlalchemy import select
from sqlalchemy import and_, select
from sqlalchemy.orm import selectinload

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


@router.get("", response_model=List[DentistResponse], summary="List approved dental practitioners")
async def list_approved_dentists(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> List[DentistResponse]:
    """
    Returns list of verified, approved dental practitioners for discovery and appointment booking.
    """
    dentists = await DentistService.list_approved_dentists(db)
    return [_build_dentist_response(d.user, d) for d in dentists]


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


# =============================================================================
# Dentist Clinical Reviews & Practitioner Relationships
# =============================================================================


@router.get(
    "/me/reviews",
    response_model=DentistPendingReviewListResponse,
    summary="List pending screening reviews assigned to authenticated dentist",
)
async def list_my_pending_reviews(
    current_user: User = Depends(require_dentist),
    db: AsyncSession = Depends(get_db),
) -> DentistPendingReviewListResponse:
    """Retrieve all pending, unfinalized clinical reviews assigned to the practitioner."""
    return await DentistAssessmentService.get_dentist_pending_reviews(db=db, user=current_user)


@router.get(
    "/me/patient-cases",
    response_model=DentistPatientCaseListResponse,
    summary="List authorized patient screening cases for authenticated dentist",
)
async def list_my_patient_cases(
    current_user: User = Depends(require_dentist),
    db: AsyncSession = Depends(get_db),
) -> DentistPatientCaseListResponse:
    """Retrieve authorized patient screening cases for the authenticated dentist.

    CRITICAL SECURITY FILTERING:
    A dentist may only access screening cases that are legitimately linked to their clinical workflow:
    1. Screenings with an explicit DentistAssessment assigned to or created by this dentist.
    2. Screenings linked to an appointment with this dentist.

    Historical appointments without an associated screening DO NOT grant access to unrelated screenings.
    """
    stmt_d = select(Dentist).where(Dentist.user_id == current_user.id)
    dentist = (await db.execute(stmt_d)).scalar_one_or_none()
    if dentist is None or dentist.verification_status != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Dentist profile is not approved.",
        )

    # 1. Screenings with explicit assessment by/assigned to this dentist
    stmt_da = select(DentistAssessment).where(DentistAssessment.dentist_id == dentist.id)
    res_da = await db.execute(stmt_da)
    assessments = list(res_da.scalars().all())
    assessment_map = {a.screening_id: a for a in assessments}

    # 2. Screenings linked to an appointment with this dentist
    stmt_appt = select(Appointment).where(
        and_(
            Appointment.dentist_id == dentist.id,
            Appointment.screening_id.is_not(None),
        )
    )
    res_appt = await db.execute(stmt_appt)
    appts = list(res_appt.scalars().all())
    appt_screening_ids = {a.screening_id for a in appts if a.screening_id}
    appt_map = {a.screening_id: a.id for a in appts if a.screening_id}

    authorized_screening_ids = set(assessment_map.keys()) | appt_screening_ids

    if not authorized_screening_ids:
        return DentistPatientCaseListResponse(items=[], total=0)

    # 3. Query the authorized screenings
    stmt_screenings = (
        select(Screening)
        .where(
            and_(
                Screening.id.in_(authorized_screening_ids),
                Screening.is_deleted.is_(False),
            )
        )
        .options(
            selectinload(Screening.patient).selectinload(Patient.user),
            selectinload(Screening.ai_predictions),
            selectinload(Screening.risk_assessment),
        )
        .order_by(Screening.created_at.desc())
    )
    res_s = await db.execute(stmt_screenings)
    screenings = list(res_s.scalars().all())

    items = []
    for s in screenings:
        p_name = "Patient"
        if s.patient and s.patient.user:
            p_name = f"{s.patient.user.first_name} {s.patient.user.last_name}".strip()

        # AI Prediction
        ai_class = None
        if s.ai_predictions:
            prediction = s.ai_predictions[0]
            ai_class = prediction.predicted_class if prediction else None

        # Risk Assessment
        risk_level = None
        risk_score = None
        if s.risk_assessment:
            risk_level = s.risk_assessment.risk_level
            risk_score = float(s.risk_assessment.risk_score) if s.risk_assessment.risk_score is not None else None

        # Review status
        da = assessment_map.get(s.id)
        if da:
            review_status = "finalized" if da.is_finalized else "pending_review"
            assessment_id = da.id
        else:
            review_status = "consultation_linked"
            assessment_id = None

        items.append(
            DentistPatientCaseItem(
                screening_id=s.id,
                patient_id=s.patient_id,
                patient_name=p_name,
                screening_date=s.created_at,
                status=s.status,
                ai_class=ai_class,
                risk_level=risk_level,
                risk_score=risk_score,
                review_status=review_status,
                assessment_id=assessment_id,
                appointment_id=appt_map.get(s.id),
            )
        )

    return DentistPatientCaseListResponse(items=items, total=len(items))


@router.get(
    "/my-practitioners",
    response_model=List[DentistResponse],
    summary="List approved dental practitioners with whom patient has an active relationship",
)
async def list_my_practitioners(
    current_user: User = Depends(require_patient),
    db: AsyncSession = Depends(get_db),
) -> List[DentistResponse]:
    """Retrieve all approved dental practitioners who maintain an active clinical relationship or appointment with the authenticated patient."""
    stmt_p = select(Patient).where(Patient.user_id == current_user.id)
    patient = (await db.execute(stmt_p)).scalar_one_or_none()
    if patient is None:
        return []

    # 1. Query approved dentists with active PatientDentistRelationship
    stmt_rel = (
        select(Dentist)
        .join(PatientDentistRelationship, PatientDentistRelationship.dentist_id == Dentist.id)
        .join(User, Dentist.user_id == User.id)
        .where(
            PatientDentistRelationship.patient_id == patient.id,
            PatientDentistRelationship.status == "active",
            Dentist.verification_status == "approved",
            User.is_active.is_(True),
        )
        .options(selectinload(Dentist.user))
        .distinct()
    )
    res_rel = await db.execute(stmt_rel)
    dentists_map = {d.id: d for d in res_rel.scalars().all()}

    # 2. Also include approved dentists linked via non-cancelled appointments (and auto-sync relationship)
    stmt_appt = (
        select(Dentist)
        .join(Appointment, Appointment.dentist_id == Dentist.id)
        .join(User, Dentist.user_id == User.id)
        .where(
            Appointment.patient_id == patient.id,
            Appointment.status.in_(["requested", "confirmed", "in_progress", "completed"]),
            Dentist.verification_status == "approved",
            User.is_active.is_(True),
        )
        .options(selectinload(Dentist.user))
        .distinct()
    )
    res_appt = await db.execute(stmt_appt)
    has_new_rel = False
    for d in res_appt.scalars().all():
        if d.id not in dentists_map:
            dentists_map[d.id] = d
            stmt_chk = select(PatientDentistRelationship).where(
                and_(
                    PatientDentistRelationship.patient_id == patient.id,
                    PatientDentistRelationship.dentist_id == d.id,
                )
            )
            existing_rel = (await db.execute(stmt_chk)).scalar_one_or_none()
            if existing_rel is None:
                new_rel = PatientDentistRelationship(
                    id=uuid.uuid4(),
                    patient_id=patient.id,
                    dentist_id=d.id,
                    status="active",
                    established_via="appointment",
                )
                db.add(new_rel)
                has_new_rel = True
            elif existing_rel.status != "active":
                existing_rel.status = "active"
                has_new_rel = True

    if has_new_rel:
        await db.commit()

    return [_build_dentist_response(d.user, d) for d in dentists_map.values()]
