"""
OraVisionAI — Patient API Endpoints

Provides endpoints for patient personal demographic and clinical medical profiles.
Restricted exclusively to authenticated users in the patient role.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_patient
from app.db.session import get_db
from app.models.user import User
from app.schemas.patient import (
    PatientMedicalProfileCreate,
    PatientMedicalProfileResponse,
    PatientMedicalProfileUpdate,
    PatientResponse,
    PatientUpdate,
)
from app.services.patient_service import PatientService

router = APIRouter(prefix="/patients", tags=["Patients"])


def _build_patient_response(user: User, patient) -> PatientResponse:
    has_med = patient.medical_profile is not None
    return PatientResponse(
        id=patient.id,
        user_id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        phone_number=user.phone_number,
        avatar_url=user.avatar_url,
        date_of_birth=patient.date_of_birth,
        gender=patient.gender,
        emergency_contact_name=patient.emergency_contact_name,
        emergency_contact_phone=patient.emergency_contact_phone,
        address=patient.address,
        has_medical_profile=has_med,
        created_at=patient.created_at,
        updated_at=patient.updated_at,
    )


@router.get("/me", response_model=PatientResponse)
async def get_my_patient_profile(
    current_user: User = Depends(require_patient),
    db: AsyncSession = Depends(get_db),
) -> PatientResponse:
    patient = await PatientService.get_or_create_patient(db, current_user)
    return _build_patient_response(current_user, patient)


@router.patch("/me", response_model=PatientResponse)
async def update_my_patient_profile(
    update_data: PatientUpdate,
    current_user: User = Depends(require_patient),
    db: AsyncSession = Depends(get_db),
) -> PatientResponse:
    patient = await PatientService.get_or_create_patient(db, current_user)
    updated_patient = await PatientService.update_patient_profile(
        db=db,
        patient=patient,
        update_data=update_data,
        user=current_user,
    )
    return _build_patient_response(current_user, updated_patient)


@router.get("/me/medical-profile", response_model=PatientMedicalProfileResponse)
async def get_my_medical_profile(
    current_user: User = Depends(require_patient),
    db: AsyncSession = Depends(get_db),
) -> PatientMedicalProfileResponse:
    patient = await PatientService.get_or_create_patient(db, current_user)
    medical_profile = await PatientService.get_medical_profile(db, patient.id)
    if medical_profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medical profile not found for this patient",
        )
    return medical_profile


@router.post(
    "/me/medical-profile",
    response_model=PatientMedicalProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_my_medical_profile(
    create_data: PatientMedicalProfileCreate,
    current_user: User = Depends(require_patient),
    db: AsyncSession = Depends(get_db),
) -> PatientMedicalProfileResponse:
    patient = await PatientService.get_or_create_patient(db, current_user)
    try:
        medical_profile = await PatientService.create_medical_profile(
            db=db,
            patient_id=patient.id,
            create_data=create_data,
        )
        return medical_profile
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )


@router.patch("/me/medical-profile", response_model=PatientMedicalProfileResponse)
async def update_my_medical_profile(
    update_data: PatientMedicalProfileUpdate,
    current_user: User = Depends(require_patient),
    db: AsyncSession = Depends(get_db),
) -> PatientMedicalProfileResponse:
    patient = await PatientService.get_or_create_patient(db, current_user)
    medical_profile = await PatientService.get_medical_profile(db, patient.id)
    if medical_profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medical profile not found for this patient",
        )

    updated_profile = await PatientService.update_medical_profile(
        db=db,
        medical_profile=medical_profile,
        update_data=update_data,
    )
    return updated_profile
