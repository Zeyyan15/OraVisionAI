"""
OraVisionAI — User Service

Business logic for user synchronization, lookup, and profile management.
Maintains authoritative identity mapping between Firebase UIDs and PostgreSQL Users.
"""

from __future__ import annotations

import logging
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import FirebaseUser
from app.models.dentist import Dentist
from app.models.patient import Patient
from app.models.user import User
from app.schemas.user import UserUpdate

logger = logging.getLogger(__name__)


class UserService:
    @staticmethod
    async def get_by_id(db: AsyncSession, user_id: uuid.UUID) -> Optional[User]:
        stmt = select(User).where(User.id == user_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_firebase_uid(db: AsyncSession, firebase_uid: str) -> Optional[User]:
        stmt = select(User).where(User.firebase_uid == firebase_uid)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_email(db: AsyncSession, email: str) -> Optional[User]:
        stmt = select(User).where(User.email == email)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def sync_firebase_user(
        db: AsyncSession,
        firebase_user: FirebaseUser,
        requested_role: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
    ) -> User:
        user = await UserService.get_by_firebase_uid(db, firebase_user.uid)

        if user is not None:
            updated = False
            if user.is_email_verified != firebase_user.email_verified:
                user.is_email_verified = firebase_user.email_verified
                updated = True

            if firebase_user.picture and not user.avatar_url:
                user.avatar_url = firebase_user.picture
                updated = True

            if firebase_user.email and firebase_user.email != user.email:
                existing_email_user = await UserService.get_by_email(db, firebase_user.email)
                if existing_email_user is None:
                    user.email = firebase_user.email
                    updated = True
                else:
                    logger.warning(
                        "Email change collision detected for Firebase UID %s with email %s",
                        firebase_user.uid,
                        firebase_user.email,
                    )

            if updated:
                await db.commit()
                await db.refresh(user)

            return user

        fn = first_name or ""
        ln = last_name or ""

        if not fn and firebase_user.name:
            name_parts = firebase_user.name.strip().split(" ", 1)
            fn = name_parts[0]
            ln = name_parts[1] if len(name_parts) > 1 else ""

        if not fn:
            fn = "User"
        if not ln:
            ln = "User"

        email = firebase_user.email or f"{firebase_user.uid}@placeholder.oravision.ai"

        existing_user_by_email = await UserService.get_by_email(db, email)
        if existing_user_by_email is not None and not existing_user_by_email.firebase_uid:
            existing_user_by_email.firebase_uid = firebase_user.uid
            existing_user_by_email.is_email_verified = firebase_user.email_verified
            if firebase_user.picture:
                existing_user_by_email.avatar_url = firebase_user.picture
            await db.commit()
            await db.refresh(existing_user_by_email)
            return existing_user_by_email

        role = "patient"
        if requested_role and requested_role.lower() == "dentist":
            role = "dentist"

        user_id = uuid.uuid4()
        new_user = User(
            id=user_id,
            firebase_uid=firebase_user.uid,
            email=email,
            role=role,
            first_name=fn,
            last_name=ln,
            avatar_url=firebase_user.picture,
            is_active=True,
            is_email_verified=firebase_user.email_verified,
        )
        db.add(new_user)

        if role == "patient":
            patient_profile = Patient(
                id=uuid.uuid4(),
                user_id=user_id,
            )
            db.add(patient_profile)
        elif role == "dentist":
            dentist_profile = Dentist(
                id=uuid.uuid4(),
                user_id=user_id,
                license_number=f"PENDING-{uuid.uuid4().hex[:8].upper()}",
                specialization="General Dentistry",
                verification_status="pending",
            )
            db.add(dentist_profile)

        await db.commit()
        await db.refresh(new_user)
        logger.info("Created new application user %s with role %s", new_user.id, new_user.role)
        return new_user

    @staticmethod
    async def update_profile(
        db: AsyncSession,
        user: User,
        update_data: UserUpdate,
    ) -> User:
        if update_data.first_name is not None:
            user.first_name = update_data.first_name
        if update_data.last_name is not None:
            user.last_name = update_data.last_name
        if update_data.phone_number is not None:
            user.phone_number = update_data.phone_number
        if update_data.avatar_url is not None:
            user.avatar_url = update_data.avatar_url

        await db.commit()
        await db.refresh(user)
        return user
