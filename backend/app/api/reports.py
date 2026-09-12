"""
OraVisionAI — Clinical Report API Endpoints

Handles clinical report retrieval, detail inspection, and secure PDF document downloads.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user
from app.core.security import enforce_rate_limit
from app.db.session import get_db
from app.models.user import User
from app.schemas.report import ReportResponse
from app.services.report_service import ReportService

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
)


@router.get(
    "/{report_id}",
    response_model=ReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Get clinical report by ID",
)
async def get_report_by_id(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ReportResponse:
    try:
        report = await ReportService.get_report_by_id(
            db=db,
            user=current_user,
            report_id=report_id,
        )
        return ReportResponse.model_validate(report)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.get(
    "/{report_id}/download",
    status_code=status.HTTP_200_OK,
    summary="Download clinical report PDF",
)
async def download_report_pdf(
    report_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Response:
    await enforce_rate_limit(request, scope="report_ops", user_id=current_user.id)
    try:
        pdf_bytes, filename = await ReportService.get_report_pdf_bytes(
            db=db,
            user=current_user,
            report_id=report_id,
        )
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Length": str(len(pdf_bytes)),
            },
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
