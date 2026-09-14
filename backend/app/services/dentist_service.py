"""
OraVisionAI — Dentist Service

Business logic for dentist profile management, verification submissions, and credential lifecycles.
Enforces strict dentist ownership boundaries using authenticated PostgreSQL User records.
"""

from __future__ import annotations

import logging
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.dentist import Dentist
from app.models.dentist_verification import DentistVerification
from app.models.user import User
from app.schemas.dentist import DentistUpdate, DentistVerificationCreate

logger = logging.getLogger(__name__)


class DentistService:
    @staticmethod
    async def get_dentist_by_user_id(
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> Optional[Dentist]:
        stmt = (
            select(Dentist)
            .where(Dentist.user_id == user_id)
            .options(selectinload(Dentist.verifications))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_or_create_dentist(
        db: AsyncSession,
        user: User,
    ) -> Dentist:
        dentist = await DentistService.get_dentist_by_user_id(db, user.id)
        if dentist is not None:
            return dentist

        dentist = Dentist(
            id=uuid.uuid4(),
            user_id=user.id,
            license_number=f"PENDING-{uuid.uuid4().hex[:8].upper()}",
            specialization="General Dentistry",
            verification_status="pending",
        )
        db.add(dentist)
        await db.commit()
        await db.refresh(dentist)
        logger.info("Created dentist profile %s for user %s", dentist.id, user.id)
        return dentist

    @staticmethod
    async def update_dentist_profile(
        db: AsyncSession,
        dentist: Dentist,
        update_data: DentistUpdate,
        user: Optional[User] = None,
    ) -> Dentist:
        if update_data.specialization is not None:
            dentist.specialization = update_data.specialization
        if update_data.clinic_name is not None:
            dentist.clinic_name = update_data.clinic_name
        if update_data.clinic_address is not None:
            dentist.clinic_address = update_data.clinic_address
        if update_data.years_of_experience is not None:
            dentist.years_of_experience = update_data.years_of_experience
        if update_data.bio is not None:
            dentist.bio = update_data.bio

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
        await db.refresh(dentist)
        if user is not None:
            await db.refresh(user)

        return dentist

    @staticmethod
    async def get_latest_verification(
        db: AsyncSession,
        dentist_id: uuid.UUID,
    ) -> Optional[DentistVerification]:
        stmt = (
            select(DentistVerification)
            .where(DentistVerification.dentist_id == dentist_id)
            .order_by(DentistVerification.submitted_at.desc())
        )
        result = await db.execute(stmt)
        return result.scalars().first()

    @staticmethod
    async def submit_verification(
        db: AsyncSession,
        dentist: Dentist,
        create_data: DentistVerificationCreate,
    ) -> DentistVerification:
        stmt = select(DentistVerification).where(
            DentistVerification.dentist_id == dentist.id,
            DentistVerification.status == "pending",
        )
        result = await db.execute(stmt)
        active_pending = result.scalars().first()

        if active_pending is not None:
            raise ValueError("An active verification submission is already pending administrator review.")

        verification = DentistVerification(
            id=uuid.uuid4(),
            dentist_id=dentist.id,
            document_type=create_data.document_type,
            document_url=create_data.document_url,
            file_name=create_data.file_name,
            file_size_bytes=create_data.file_size_bytes,
            status="pending",
        )
        db.add(verification)

        if dentist.verification_status != "approved":
            dentist.verification_status = "pending"

        await db.commit()
        await db.refresh(verification)
        await db.refresh(dentist)
        logger.info("Submitted verification %s for dentist %s", verification.id, dentist.id)
        return verification

    @staticmethod
    async def list_approved_dentists(
        db: AsyncSession,
    ) -> list[Dentist]:
        stmt = (
            select(Dentist)
            .where(Dentist.verification_status == "approved")
            .options(selectinload(Dentist.user))
            .order_by(Dentist.created_at.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())
