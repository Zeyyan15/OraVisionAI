"""
OraVisionAI — Admin Service

Business logic for administrative user management, dentist verification review workflows, and audit logging.
"""

from __future__ import annotations

import datetime
import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.audit_log import AuditLog
from app.models.dentist import Dentist
from app.models.dentist_verification import DentistVerification
from app.models.user import User
from app.services.dentist_availability_service import DentistAvailabilityService
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


class AdminService:
    @staticmethod
    async def create_audit_log(
        db: AsyncSession,
        user_id: Optional[uuid.UUID],
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuditLog:
        audit_entry = AuditLog(
            id=uuid.uuid4(),
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details or {},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)
        await db.commit()
        await db.refresh(audit_entry)
        logger.info(
            "AuditLog recorded: action=%s, resource=%s:%s, actor=%s",
            action,
            resource_type,
            resource_id,
            user_id,
        )
        return audit_entry

    @staticmethod
    async def list_users(
        db: AsyncSession,
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[User], int]:
        page = max(1, page)
        page_size = max(1, min(page_size, 100))
        offset = (page - 1) * page_size

        count_stmt = select(func.count()).select_from(User)
        query_stmt = (
            select(User)
            .options(
                selectinload(User.patient),
                selectinload(User.dentist),
            )
            .order_by(User.created_at.desc())
        )

        if role is not None:
            count_stmt = count_stmt.where(User.role == role)
            query_stmt = query_stmt.where(User.role == role)

        if is_active is not None:
            count_stmt = count_stmt.where(User.is_active == is_active)
            query_stmt = query_stmt.where(User.is_active == is_active)

        total_count = (await db.execute(count_stmt)).scalar() or 0
        users = (await db.execute(query_stmt.offset(offset).limit(page_size))).scalars().all()

        return list(users), total_count

    @staticmethod
    async def get_user_by_id(
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> Optional[User]:
        stmt = (
            select(User)
            .where(User.id == user_id)
            .options(
                selectinload(User.patient),
                selectinload(User.dentist),
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def update_user_status(
        db: AsyncSession,
        admin_user: User,
        target_user_id: uuid.UUID,
        new_status: bool,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> User:
        if target_user_id == admin_user.id and not new_status:
            raise ValueError("Administrators cannot deactivate their own account.")

        target_user = await AdminService.get_user_by_id(db, target_user_id)
        if target_user is None:
            raise LookupError(f"User with ID {target_user_id} was not found.")

        old_status = target_user.is_active
        target_user.is_active = new_status

        await db.commit()
        await db.refresh(target_user)

        await AdminService.create_audit_log(
            db=db,
            user_id=admin_user.id,
            action="USER_STATUS_UPDATE",
            resource_type="user",
            resource_id=str(target_user_id),
            details={
                "target_email": target_user.email,
                "previous_is_active": old_status,
                "new_is_active": new_status,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return target_user

    @staticmethod
    async def list_dentist_verifications(
        db: AsyncSession,
        status: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[DentistVerification], int]:
        page = max(1, page)
        page_size = max(1, min(page_size, 100))
        offset = (page - 1) * page_size

        count_stmt = select(func.count()).select_from(DentistVerification)
        query_stmt = (
            select(DentistVerification)
            .options(
                selectinload(DentistVerification.dentist).selectinload(Dentist.user),
            )
            .order_by(DentistVerification.submitted_at.desc())
        )

        if status is not None:
            count_stmt = count_stmt.where(DentistVerification.status == status)
            query_stmt = query_stmt.where(DentistVerification.status == status)

        total_count = (await db.execute(count_stmt)).scalar() or 0
        verifications = (await db.execute(query_stmt.offset(offset).limit(page_size))).scalars().all()

        return list(verifications), total_count

    @staticmethod
    async def get_dentist_verification_by_id(
        db: AsyncSession,
        verification_id: uuid.UUID,
    ) -> Optional[DentistVerification]:
        stmt = (
            select(DentistVerification)
            .where(DentistVerification.id == verification_id)
            .options(
                selectinload(DentistVerification.dentist).selectinload(Dentist.user),
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def approve_dentist_verification(
        db: AsyncSession,
        admin_user: User,
        verification_id: uuid.UUID,
        review_notes: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> DentistVerification:
        verification = await AdminService.get_dentist_verification_by_id(db, verification_id)
        if verification is None:
            raise LookupError(f"Verification submission {verification_id} was not found.")

        if verification.status != "pending":
            raise ValueError(
                f"Cannot approve verification with current status '{verification.status}'. Only pending verifications can be approved."
            )

        now = datetime.datetime.now(datetime.timezone.utc)
        verification.status = "approved"
        verification.reviewer_id = admin_user.id
        verification.reviewed_at = now
        if review_notes:
            verification.review_notes = review_notes

        dentist = verification.dentist
        dentist.verification_status = "approved"
        dentist.verified_at = now
        dentist.verified_by_id = admin_user.id
        dentist.rejection_reason = None

        await db.commit()
        await db.refresh(verification)
        await db.refresh(dentist)

        # Idempotently provision default availability windows if none configured
        try:
            await DentistAvailabilityService.ensure_default_availability(db, dentist.id)
        except Exception as exc:
            logger.warning("Failed to auto-provision default availability for dentist %s: %s", dentist.id, exc)

        # Notify dentist of successful verification
        try:
            await NotificationService.create_notification(
                db=db,
                user_id=dentist.user_id,
                notification_type="dentist_verified",
                title="Credentials Approved",
                message="Your dental practitioner credentials have been approved. You now have full access to clinical features.",
                action_url="/dentist/dashboard",
                suppress_duplicates_window_seconds=300,
            )
            await db.commit()
        except Exception as exc:
            logger.warning("Failed to emit dentist_verified notification: %s", exc)

        await AdminService.create_audit_log(
            db=db,
            user_id=admin_user.id,
            action="DENTIST_VERIFICATION_APPROVED",
            resource_type="dentist_verification",
            resource_id=str(verification_id),
            details={
                "dentist_id": str(dentist.id),
                "dentist_user_id": str(dentist.user_id),
                "license_number": dentist.license_number,
                "review_notes": review_notes,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return verification

    @staticmethod
    async def reject_dentist_verification(
        db: AsyncSession,
        admin_user: User,
        verification_id: uuid.UUID,
        review_notes: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> DentistVerification:
        verification = await AdminService.get_dentist_verification_by_id(db, verification_id)
        if verification is None:
            raise LookupError(f"Verification submission {verification_id} was not found.")

        if verification.status != "pending":
            raise ValueError(
                f"Cannot reject verification with current status '{verification.status}'. Only pending verifications can be rejected."
            )

        now = datetime.datetime.now(datetime.timezone.utc)
        verification.status = "rejected"
        verification.reviewer_id = admin_user.id
        verification.reviewed_at = now
        if review_notes:
            verification.review_notes = review_notes

        dentist = verification.dentist
        dentist.verification_status = "rejected"
        dentist.rejection_reason = review_notes

        await db.commit()
        await db.refresh(verification)
        await db.refresh(dentist)

        await AdminService.create_audit_log(
            db=db,
            user_id=admin_user.id,
            action="DENTIST_VERIFICATION_REJECTED",
            resource_type="dentist_verification",
            resource_id=str(verification_id),
            details={
                "dentist_id": str(dentist.id),
                "dentist_user_id": str(dentist.user_id),
                "license_number": dentist.license_number,
                "rejection_reason": review_notes,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return verification
