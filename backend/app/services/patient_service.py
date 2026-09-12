"""
OraVisionAI — Patient Service

Business logic for patient profile management, medical history, and clinical risk factors.
Enforces strict patient ownership boundaries using authenticated PostgreSQL User records.
"""

from __future__ import annotations

import logging
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.patient import Patient
from app.models.patient_medical_profile import PatientMedicalProfile
from app.models.user import User
from app.schemas.patient import (
    PatientMedicalProfileCreate,
    PatientMedicalProfileUpdate,
    PatientUpdate,
)

logger = logging.getLogger(__name__)


class PatientService:
    @staticmethod
    async def get_patient_by_user_id(
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> Optional[Patient]:
        stmt = (
            select(Patient)
            .where(Patient.user_id == user_id)
            .options(selectinload(Patient.medical_profile))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_or_create_patient(
        db: AsyncSession,
        user: User,
    ) -> Patient:
        patient = await PatientService.get_patient_by_user_id(db, user.id)
        if patient is not None:
            return patient

        patient = Patient(
            id=uuid.uuid4(),
            user_id=user.id,
        )
        db.add(patient)
        await db.commit()
        await db.refresh(patient)
        logger.info("Created patient profile %s for user %s", patient.id, user.id)
        return patient

    @staticmethod
    async def update_patient_profile(
        db: AsyncSession,
        patient: Patient,
        update_data: PatientUpdate,
        user: Optional[User] = None,
    ) -> Patient:
        if update_data.date_of_birth is not None:
            patient.date_of_birth = update_data.date_of_birth
        if update_data.gender is not None:
            patient.gender = update_data.gender
        if update_data.emergency_contact_name is not None:
            patient.emergency_contact_name = update_data.emergency_contact_name
        if update_data.emergency_contact_phone is not None:
            patient.emergency_contact_phone = update_data.emergency_contact_phone
        if update_data.address is not None:
            patient.address = update_data.address

        if user is not None:
            if update_data.first_name is not None:
                user.first_name = update_data.first_name
            if update_data.last_name is not None:
                user.last_name = update_data.last_name
            if update_data.phone_number is not None:
                user.phone_number = update_data.phone_number
            if update_data.avatar_url is not None:
                user.avatar_url = update_data.avatar_url

        await db.commit()
        await db.refresh(patient)
        if user is not None:
            await db.refresh(user)

        return patient

    @staticmethod
    async def get_medical_profile(
        db: AsyncSession,
        patient_id: uuid.UUID,
    ) -> Optional[PatientMedicalProfile]:
        stmt = select(PatientMedicalProfile).where(
            PatientMedicalProfile.patient_id == patient_id
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def create_medical_profile(
        db: AsyncSession,
        patient_id: uuid.UUID,
        create_data: PatientMedicalProfileCreate,
    ) -> PatientMedicalProfile:
        existing = await PatientService.get_medical_profile(db, patient_id)
        if existing is not None:
            raise ValueError("Medical profile already exists for this patient")

        medical_profile = PatientMedicalProfile(
            id=uuid.uuid4(),
            patient_id=patient_id,
            medical_history=create_data.medical_history,
            dental_history=create_data.dental_history,
            allergies=create_data.allergies,
            current_medications=create_data.current_medications,
            smoking_status=create_data.smoking_status,
            alcohol_consumption=create_data.alcohol_consumption,
            betel_quid_user=create_data.betel_quid_user,
            additional_notes=create_data.additional_notes,
        )
        db.add(medical_profile)
        await db.commit()
        await db.refresh(medical_profile)
        logger.info("Created medical profile %s for patient %s", medical_profile.id, patient_id)
        return medical_profile

    @staticmethod
    async def update_medical_profile(
        db: AsyncSession,
        medical_profile: PatientMedicalProfile,
        update_data: PatientMedicalProfileUpdate,
    ) -> PatientMedicalProfile:
        if update_data.medical_history is not None:
            medical_profile.medical_history = update_data.medical_history
        if update_data.dental_history is not None:
            medical_profile.dental_history = update_data.dental_history
        if update_data.allergies is not None:
            medical_profile.allergies = update_data.allergies
        if update_data.current_medications is not None:
            medical_profile.current_medications = update_data.current_medications
        if update_data.smoking_status is not None:
            medical_profile.smoking_status = update_data.smoking_status
        if update_data.alcohol_consumption is not None:
            medical_profile.alcohol_consumption = update_data.alcohol_consumption
        if update_data.betel_quid_user is not None:
            medical_profile.betel_quid_user = update_data.betel_quid_user
        if update_data.additional_notes is not None:
            medical_profile.additional_notes = update_data.additional_notes

        await db.commit()
        await db.refresh(medical_profile)
        logger.info("Updated medical profile %s for patient %s", medical_profile.id, medical_profile.patient_id)
        return medical_profile
