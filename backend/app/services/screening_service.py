"""
OraVisionAI — Patient Screening Domain Service

Encapsulates CRUD operations, pagination, patient ownership enforcement,
image attachments, and soft deletion for oral health screenings.
"""

from __future__ import annotations

import logging
import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.screening import Screening
from app.models.screening_image import ScreeningImage
from app.schemas.screening import ScreeningCreate
from app.services.storage_service import StorageService

logger = logging.getLogger(__name__)


class ScreeningService:
    @staticmethod
    async def create_screening(
        db: AsyncSession,
        patient_id: uuid.UUID,
        created_by_id: uuid.UUID,
        create_data: ScreeningCreate,
    ) -> Screening:
        screening = Screening(
            patient_id=patient_id,
            created_by_id=created_by_id,
            status="pending",
            clinical_notes=create_data.clinical_notes,
            is_deleted=False,
        )
        db.add(screening)
        await db.commit()
        await db.refresh(screening)
        logger.info("Created screening %s for patient %s", screening.id, patient_id)
        return screening

    @staticmethod
    async def get_patient_screening(
        db: AsyncSession,
        patient_id: uuid.UUID,
        screening_id: uuid.UUID,
    ) -> Optional[Screening]:
        stmt = (
            select(Screening)
            .where(
                Screening.id == screening_id,
                Screening.patient_id == patient_id,
                Screening.is_deleted.is_(False),
            )
            .options(selectinload(Screening.images))
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_patient_screenings(
        db: AsyncSession,
        patient_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[Screening], int]:
        base_query = select(Screening).where(
            Screening.patient_id == patient_id,
            Screening.is_deleted.is_(False),
        )

        count_stmt = select(func.count()).select_from(base_query.subquery())
        count_res = await db.execute(count_stmt)
        total = count_res.scalar() or 0

        offset = (page - 1) * page_size
        stmt = (
            base_query.order_by(Screening.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
        result = await db.execute(stmt)
        items = list(result.scalars().all())

        return items, total

    @staticmethod
    async def attach_screening_image(
        db: AsyncSession,
        patient_id: uuid.UUID,
        screening_id: uuid.UUID,
        file_bytes: bytes,
        original_filename: str,
        content_type: str,
        is_primary: bool = True,
    ) -> ScreeningImage:
        screening = await ScreeningService.get_patient_screening(
            db=db,
            patient_id=patient_id,
            screening_id=screening_id,
        )
        if screening is None:
            raise LookupError(f"Screening '{screening_id}' not found or inaccessible.")

        upload_meta = await StorageService.upload_screening_image(
            file_bytes=file_bytes,
            patient_id=patient_id,
            screening_id=screening_id,
            original_filename=original_filename,
            content_type=content_type,
        )

        image_record = ScreeningImage(
            screening_id=screening_id,
            storage_path=upload_meta["storage_path"],
            file_name=upload_meta["file_name"],
            file_size_bytes=upload_meta["file_size_bytes"],
            mime_type=upload_meta["mime_type"],
            image_width=upload_meta["image_width"],
            image_height=upload_meta["image_height"],
            image_sha256=upload_meta["image_sha256"],
            is_primary=is_primary,
        )

        try:
            db.add(image_record)
            if is_primary:
                screening.status = "uploading"
            await db.commit()
            await db.refresh(image_record)
            logger.info("Persisted image %s for screening %s", image_record.id, screening_id)
            return image_record
        except Exception as exc:
            await db.rollback()
            StorageService.delete_storage_object(upload_meta["storage_path"])
            logger.error("Failed to persist image record: %s; rolled back storage object.", exc)
            raise

    @staticmethod
    async def soft_delete_screening(
        db: AsyncSession,
        patient_id: uuid.UUID,
        screening_id: uuid.UUID,
    ) -> bool:
        screening = await ScreeningService.get_patient_screening(
            db=db,
            patient_id=patient_id,
            screening_id=screening_id,
        )
        if screening is None:
            return False

        screening.is_deleted = True
        screening.deleted_at = func.now()
        await db.commit()
        logger.info("Soft-deleted screening %s for patient %s", screening_id, patient_id)
        return True
