"""
OraVisionAI — Dentist Availability Domain Service

Encapsulates business logic, ownership authorization, time-window validation,
overlap prevention, and audit logging for dentist consultation availability windows.
"""

from __future__ import annotations

import datetime
import logging
import uuid
from typing import Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.dentist import Dentist
from app.models.dentist_availability import DentistAvailability
from app.models.user import User
from app.schemas.dentist_availability import (
    DentistAvailabilityCreate,
    DentistAvailabilityListResponse,
    DentistAvailabilityResponse,
    DentistAvailabilityUpdate,
)

logger = logging.getLogger("oravision.services.dentist_availability")


class DentistAvailabilityService:
    """Domain service managing weekly recurring availability for verified dentists."""

    @classmethod
    async def _require_approved_dentist(
        cls,
        db: AsyncSession,
        user: User,
    ) -> Dentist:
        """Verify the user is an active, approved dentist and return their Dentist profile."""
        if user.role != "dentist":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access restricted exclusively to users with the dentist role.",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive.",
            )

        stmt = select(Dentist).where(Dentist.user_id == user.id)
        res = await db.execute(stmt)
        dentist = res.scalar_one_or_none()

        if dentist is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dentist professional profile not found.",
            )

        if dentist.verification_status != "approved":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Dentist verification status is '{dentist.verification_status}'. Only approved dentists may configure availability.",
            )

        return dentist

    @classmethod
    async def create_availability(
        cls,
        db: AsyncSession,
        user: User,
        data: DentistAvailabilityCreate,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> DentistAvailabilityResponse:
        """Create a new consultation availability window for the authenticated dentist."""
        dentist = await cls._require_approved_dentist(db, user)

        if data.start_time >= data.end_time:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="end_time must be strictly after start_time.",
            )

        # Check for overlapping active availability for this dentist on the same day_of_week
        if data.is_active:
            stmt = select(DentistAvailability).where(
                and_(
                    DentistAvailability.dentist_id == dentist.id,
                    DentistAvailability.day_of_week == data.day_of_week,
                    DentistAvailability.is_active.is_(True),
                    DentistAvailability.start_time < data.end_time,
                    DentistAvailability.end_time > data.start_time,
                )
            )
            overlap_res = await db.execute(stmt)
            if overlap_res.scalars().first() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Availability window overlaps with an existing active window for this weekday.",
                )

        availability = DentistAvailability(
            id=uuid.uuid4(),
            dentist_id=dentist.id,
            day_of_week=data.day_of_week,
            start_time=data.start_time,
            end_time=data.end_time,
            slot_duration_minutes=data.slot_duration_minutes,
            is_active=data.is_active,
        )
        db.add(availability)

        audit_entry = AuditLog(
            user_id=user.id,
            action="DENTIST_AVAILABILITY_CREATED",
            resource_type="dentist_availability",
            resource_id=str(availability.id),
            details={
                "dentist_id": str(dentist.id),
                "day_of_week": data.day_of_week,
                "start_time": str(data.start_time),
                "end_time": str(data.end_time),
                "slot_duration_minutes": data.slot_duration_minutes,
                "is_active": data.is_active,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)

        await db.commit()
        await db.refresh(availability)

        logger.info(
            "Created availability slot %s for dentist %s (weekday %d, %s-%s)",
            availability.id,
            dentist.id,
            availability.day_of_week,
            availability.start_time,
            availability.end_time,
        )

        return DentistAvailabilityResponse.model_validate(availability)

    @classmethod
    async def list_my_availabilities(
        cls,
        db: AsyncSession,
        user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> DentistAvailabilityListResponse:
        """List all availability windows (active and inactive) for the authenticated dentist."""
        dentist = await cls._require_approved_dentist(db, user)

        stmt = (
            select(DentistAvailability)
            .where(DentistAvailability.dentist_id == dentist.id)
            .order_by(DentistAvailability.day_of_week, DentistAvailability.start_time)
        )
        res = await db.execute(stmt)
        items = list(res.scalars().all())

        audit_entry = AuditLog(
            user_id=user.id,
            action="DENTIST_AVAILABILITY_VIEWED",
            resource_type="dentist_availability",
            resource_id=str(dentist.id),
            details={
                "dentist_id": str(dentist.id),
                "scope": "my_availabilities",
                "count": len(items),
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)
        await db.commit()

        return DentistAvailabilityListResponse(
            items=[DentistAvailabilityResponse.model_validate(a) for a in items],
            total=len(items),
        )

    @classmethod
    async def list_dentist_public_availabilities(
        cls,
        db: AsyncSession,
        dentist_id: uuid.UUID,
        user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> DentistAvailabilityListResponse:
        """List active availability windows for a specified approved dentist (for booking discovery)."""
        stmt_d = select(Dentist).where(Dentist.id == dentist_id)
        res_d = await db.execute(stmt_d)
        dentist = res_d.scalar_one_or_none()

        if dentist is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dentist not found.",
            )

        if dentist.verification_status != "approved":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Availability discovery is only available for approved dentists.",
            )

        stmt = (
            select(DentistAvailability)
            .where(
                and_(
                    DentistAvailability.dentist_id == dentist_id,
                    DentistAvailability.is_active.is_(True),
                )
            )
            .order_by(DentistAvailability.day_of_week, DentistAvailability.start_time)
        )
        res = await db.execute(stmt)
        items = list(res.scalars().all())

        audit_entry = AuditLog(
            user_id=user.id,
            action="DENTIST_AVAILABILITY_VIEWED",
            resource_type="dentist_availability",
            resource_id=str(dentist_id),
            details={
                "dentist_id": str(dentist_id),
                "scope": "public_discovery",
                "viewer_role": user.role,
                "count": len(items),
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)
        await db.commit()

        return DentistAvailabilityListResponse(
            items=[DentistAvailabilityResponse.model_validate(a) for a in items],
            total=len(items),
        )

    @classmethod
    async def update_availability(
        cls,
        db: AsyncSession,
        availability_id: uuid.UUID,
        user: User,
        data: DentistAvailabilityUpdate,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> DentistAvailabilityResponse:
        """Update an existing availability window owned by the authenticated dentist."""
        dentist = await cls._require_approved_dentist(db, user)

        stmt = select(DentistAvailability).where(DentistAvailability.id == availability_id)
        res = await db.execute(stmt)
        availability = res.scalar_one_or_none()

        if availability is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Availability window not found.",
            )

        if availability.dentist_id != dentist.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to modify another dentist's availability window.",
            )

        new_day = data.day_of_week if data.day_of_week is not None else availability.day_of_week
        new_start = data.start_time if data.start_time is not None else availability.start_time
        new_end = data.end_time if data.end_time is not None else availability.end_time
        new_active = data.is_active if data.is_active is not None else availability.is_active
        new_slot = data.slot_duration_minutes if data.slot_duration_minutes is not None else availability.slot_duration_minutes

        if new_start >= new_end:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="end_time must be strictly after start_time.",
            )

        # Overlap check against OTHER active windows for this dentist
        if new_active:
            overlap_stmt = select(DentistAvailability).where(
                and_(
                    DentistAvailability.dentist_id == dentist.id,
                    DentistAvailability.id != availability_id,
                    DentistAvailability.day_of_week == new_day,
                    DentistAvailability.is_active.is_(True),
                    DentistAvailability.start_time < new_end,
                    DentistAvailability.end_time > new_start,
                )
            )
            overlap_res = await db.execute(overlap_stmt)
            if overlap_res.scalars().first() is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Updated availability window overlaps with an existing active window for this weekday.",
                )

        availability.day_of_week = new_day
        availability.start_time = new_start
        availability.end_time = new_end
        availability.slot_duration_minutes = new_slot
        availability.is_active = new_active

        audit_entry = AuditLog(
            user_id=user.id,
            action="DENTIST_AVAILABILITY_UPDATED",
            resource_type="dentist_availability",
            resource_id=str(availability.id),
            details={
                "dentist_id": str(dentist.id),
                "day_of_week": new_day,
                "start_time": str(new_start),
                "end_time": str(new_end),
                "slot_duration_minutes": new_slot,
                "is_active": new_active,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)

        await db.commit()
        await db.refresh(availability)

        return DentistAvailabilityResponse.model_validate(availability)

    @classmethod
    async def delete_availability(
        cls,
        db: AsyncSession,
        availability_id: uuid.UUID,
        user: User,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Dict[str, str]:
        """Delete an availability window owned by the authenticated dentist."""
        dentist = await cls._require_approved_dentist(db, user)

        stmt = select(DentistAvailability).where(DentistAvailability.id == availability_id)
        res = await db.execute(stmt)
        availability = res.scalar_one_or_none()

        if availability is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Availability window not found.",
            )

        if availability.dentist_id != dentist.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to delete another dentist's availability window.",
            )

        audit_entry = AuditLog(
            user_id=user.id,
            action="DENTIST_AVAILABILITY_DELETED",
            resource_type="dentist_availability",
            resource_id=str(availability.id),
            details={
                "dentist_id": str(dentist.id),
                "day_of_week": availability.day_of_week,
                "start_time": str(availability.start_time),
                "end_time": str(availability.end_time),
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)

        await db.delete(availability)
        await db.commit()

        logger.info("Deleted availability slot %s for dentist %s", availability_id, dentist.id)
        return {"message": "Availability window successfully deleted.", "id": str(availability_id)}

