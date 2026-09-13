"""
OraVisionAI — Patient Screening API Endpoints

Handles screening session creation, oral image uploads, image metadata listing,
screening details, soft deletion, AI diagnostic inference execution, XAI explanations,
and clinical report generation.
"""

import logging
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_active_user, require_dentist, require_patient
from app.core.security import enforce_rate_limit
from app.db.session import get_db
from app.models.user import User

logger = logging.getLogger(__name__)
from app.schemas.ai import ScreeningInferenceResponse
from app.schemas.dentist_assessment import (
    DentistAssessmentCreate,
    DentistAssessmentResponse,
    DentistAssessmentUpdate,
    ScreeningReviewResponse,
)
from app.schemas.report import ReportGenerateRequest, ReportResponse
from app.schemas.risk_assessment import RiskAssessmentRequest, RiskAssessmentResponse
from app.schemas.screening import (
    ScreeningCreate,
    ScreeningDeleteResponse,
    ScreeningDetailResponse,
    ScreeningImageResponse,
    ScreeningListResponse,
    ScreeningResponse,
)
from app.schemas.xai import ScreeningXAIResponse, XAIGenerationRequest
from app.services.ai_inference_service import AIInferenceService
from app.services.dentist_assessment_service import DentistAssessmentService
from app.services.patient_service import PatientService
from app.services.report_service import ReportService
from app.services.risk_assessment_service import RiskAssessmentService
from app.services.screening_service import ScreeningService
from app.services.xai_service import XAIService

router = APIRouter(
    prefix="/screenings",
    tags=["screenings"],
)


@router.post(
    "",
    response_model=ScreeningResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new screening session",
)
async def create_screening(
    screening_in: ScreeningCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_patient),
) -> ScreeningResponse:
    patient = await PatientService.get_patient_by_user_id(db, current_user.id)
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found for authenticated user.",
        )

    screening = await ScreeningService.create_screening(
        db=db,
        patient_id=patient.id,
        created_by_id=current_user.id,
        create_data=screening_in,
    )
    return ScreeningResponse.model_validate(screening)


@router.get(
    "",
    response_model=ScreeningListResponse,
    status_code=status.HTTP_200_OK,
    summary="List patient's screenings",
)
async def list_screenings(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_patient),
) -> ScreeningListResponse:
    patient = await PatientService.get_patient_by_user_id(db, current_user.id)
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found for authenticated user.",
        )

    items, total = await ScreeningService.list_patient_screenings(
        db=db,
        patient_id=patient.id,
        page=page,
        page_size=page_size,
    )
    return ScreeningListResponse(
        items=[ScreeningResponse.model_validate(s) for s in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{screening_id}",
    response_model=ScreeningDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get screening details with images",
)
async def get_screening_detail(
    screening_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_patient),
) -> ScreeningDetailResponse:
    patient = await PatientService.get_patient_by_user_id(db, current_user.id)
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found for authenticated user.",
        )

    screening = await ScreeningService.get_patient_screening(
        db=db,
        patient_id=patient.id,
        screening_id=screening_id,
    )
    if screening is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Screening '{screening_id}' not found.",
        )

    return ScreeningDetailResponse.model_validate(screening)


@router.post(
    "/{screening_id}/images",
    response_model=ScreeningImageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload an oral screening image",
)
async def upload_screening_image(
    screening_id: uuid.UUID,
    file: UploadFile = File(...),
    is_primary: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_patient),
) -> ScreeningImageResponse:
    patient = await PatientService.get_patient_by_user_id(db, current_user.id)
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found for authenticated user.",
        )

    try:
        file_bytes = await file.read()
        image_record = await ScreeningService.attach_screening_image(
            db=db,
            patient_id=patient.id,
            screening_id=screening_id,
            file_bytes=file_bytes,
            original_filename=file.filename or "upload.jpg",
            content_type=file.content_type or "image/jpeg",
            is_primary=is_primary,
        )
        return ScreeningImageResponse.model_validate(image_record)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except RuntimeError as exc:
        logger.error("Failed to attach screening image: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload and attach screening image.",
        )


@router.delete(
    "/{screening_id}",
    response_model=ScreeningDeleteResponse,
    status_code=status.HTTP_200_OK,
    summary="Soft-delete a screening",
)
async def delete_screening(
    screening_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_patient),
) -> ScreeningDeleteResponse:
    patient = await PatientService.get_patient_by_user_id(db, current_user.id)
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found for authenticated user.",
        )

    success = await ScreeningService.soft_delete_screening(
        db=db,
        patient_id=patient.id,
        screening_id=screening_id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Screening '{screening_id}' not found.",
        )

    return ScreeningDeleteResponse(
        success=True,
        message=f"Screening '{screening_id}' soft-deleted successfully.",
        screening_id=screening_id,
    )


@router.post(
    "/{screening_id}/run-ai",
    response_model=ScreeningInferenceResponse,
    status_code=status.HTTP_200_OK,
    summary="Execute AI inference on screening images",
)
async def run_screening_ai_inference(
    screening_id: uuid.UUID,
    force_recompute: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_patient),
) -> ScreeningInferenceResponse:
    patient = await PatientService.get_patient_by_user_id(db, current_user.id)
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found for authenticated user.",
        )

    try:
        inference_result = await AIInferenceService.run_screening_inference(
            db=db,
            patient_id=patient.id,
            screening_id=screening_id,
            force_recompute=force_recompute,
        )
        return inference_result
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )


@router.get(
    "/{screening_id}/xai",
    response_model=ScreeningXAIResponse,
    status_code=status.HTTP_200_OK,
    summary="Get XAI visual explanation results for a screening",
)
async def get_screening_xai(
    screening_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_patient),
) -> ScreeningXAIResponse:
    patient = await PatientService.get_patient_by_user_id(db, current_user.id)
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found for authenticated user.",
        )

    try:
        return await XAIService.get_screening_xai(
            db=db,
            patient_id=patient.id,
            screening_id=screening_id,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post(
    "/{screening_id}/xai",
    response_model=ScreeningXAIResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate XAI visual explanation heatmaps for a screening",
)
async def generate_screening_xai(
    screening_id: uuid.UUID,
    request: Optional[XAIGenerationRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_patient),
) -> ScreeningXAIResponse:
    patient = await PatientService.get_patient_by_user_id(db, current_user.id)
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found for authenticated user.",
        )

    req = request or XAIGenerationRequest()
    try:
        return await XAIService.generate_screening_xai(
            db=db,
            patient_id=patient.id,
            screening_id=screening_id,
            include_secondary=req.include_secondary,
            force_recompute=req.force_recompute,
            methods=req.methods,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to generate screening XAI: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate visual explanations.",
        )


@router.post(
    "/{screening_id}/xai/{method}",
    response_model=ScreeningXAIResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate a specific XAI visual explanation method",
)
async def generate_screening_xai_method(
    screening_id: uuid.UUID,
    method: str,
    request: Request,
    force_recompute: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_patient),
) -> ScreeningXAIResponse:
    await enforce_rate_limit(request, scope="ai_run", user_id=current_user.id)
    patient = await PatientService.get_patient_by_user_id(db, current_user.id)
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found for authenticated user.",
        )

    try:
        return await XAIService.generate_screening_xai(
            db=db,
            patient_id=patient.id,
            screening_id=screening_id,
            force_recompute=force_recompute,
            methods=[method],
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to generate screening XAI method: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate visual explanations.",
        )


# =============================================================================
# Clinical Report Endpoints
# =============================================================================


@router.post(
    "/{screening_id}/report",
    response_model=ReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate clinical report and PDF document for a screening",
)
async def generate_screening_report(
    screening_id: uuid.UUID,
    http_request: Request,
    request: Optional[ReportGenerateRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ReportResponse:
    await enforce_rate_limit(http_request, scope="report_ops", user_id=current_user.id)
    req = request or ReportGenerateRequest()
    try:
        report = await ReportService.generate_screening_report(
            db=db,
            user=current_user,
            screening_id=screening_id,
            force_regenerate=req.force_regenerate,
            report_title=req.report_title or "Oral Health AI Screening Report",
        )
        return ReportResponse.model_validate(report)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to generate screening report: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while generating the clinical report.",
        )


@router.get(
    "/{screening_id}/report",
    response_model=ReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Get clinical report for a screening",
)
async def get_screening_report(
    screening_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ReportResponse:
    try:
        report = await ReportService.get_screening_report(
            db=db,
            user=current_user,
            screening_id=screening_id,
        )
        return ReportResponse.model_validate(report)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


# =============================================================================
# Risk Assessment & Screening Triage Endpoints
# =============================================================================


@router.post(
    "/{screening_id}/risk-assessment",
    response_model=RiskAssessmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate or retrieve screening risk assessment and triage priority",
)
async def generate_screening_risk_assessment(
    screening_id: uuid.UUID,
    request: Optional[RiskAssessmentRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> RiskAssessmentResponse:
    req = request or RiskAssessmentRequest()
    try:
        assessment = await RiskAssessmentService.assess_screening(
            db=db,
            user=current_user,
            screening_id=screening_id,
            force_recompute=req.force_recompute,
        )
        return RiskAssessmentResponse.model_validate(assessment)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to assess screening risk: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while computing the clinical risk assessment.",
        )


@router.get(
    "/{screening_id}/risk-assessment",
    response_model=RiskAssessmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Get existing clinical risk assessment for a screening session",
)
async def get_screening_risk_assessment(
    screening_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> RiskAssessmentResponse:
    try:
        assessment = await RiskAssessmentService.get_screening_risk_assessment(
            db=db,
            user=current_user,
            screening_id=screening_id,
        )
        return RiskAssessmentResponse.model_validate(assessment)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


# =============================================================================
# Dentist Clinical Assessment & Screening Review Endpoints
# =============================================================================


@router.get(
    "/{screening_id}/review",
    response_model=ScreeningReviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Review complete multi-modal screening findings for professional clinical evaluation",
)
async def review_screening_findings(
    screening_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ScreeningReviewResponse:
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        return await DentistAssessmentService.get_screening_for_review(
            db=db,
            user=current_user,
            screening_id=screening_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.post(
    "/{screening_id}/assessment",
    response_model=DentistAssessmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create licensed dentist clinical assessment",
)
async def create_dentist_assessment(
    screening_id: uuid.UUID,
    assessment_in: DentistAssessmentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_dentist),
) -> DentistAssessmentResponse:
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        return await DentistAssessmentService.create_assessment(
            db=db,
            user=current_user,
            screening_id=screening_id,
            create_in=assessment_in,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to create dentist assessment: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while recording the dentist assessment.",
        )


@router.get(
    "/{screening_id}/assessment",
    response_model=DentistAssessmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Get clinical dentist assessment for a screening",
)
async def get_dentist_assessment(
    screening_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> DentistAssessmentResponse:
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        return await DentistAssessmentService.get_screening_assessment(
            db=db,
            user=current_user,
            screening_id=screening_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))


@router.patch(
    "/{screening_id}/assessment",
    response_model=DentistAssessmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Update or finalize an existing dentist assessment draft",
)
async def update_dentist_assessment(
    screening_id: uuid.UUID,
    update_in: DentistAssessmentUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_dentist),
) -> DentistAssessmentResponse:
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        return await DentistAssessmentService.update_assessment(
            db=db,
            user=current_user,
            screening_id=screening_id,
            update_in=update_in,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except Exception as exc:
        logger.error("Failed to update dentist assessment: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating the dentist assessment.",
        )


# ===========================================================================
# Artifact Signed-URL Retrieval (Phase 31 — Supabase Storage)
# ===========================================================================

@router.get(
    "/{screening_id}/artifacts/signed-url",
    status_code=status.HTTP_200_OK,
    summary="Generate a short-lived signed URL for a screening artifact",
)
async def get_artifact_signed_url(
    screening_id: uuid.UUID,
    path: str = Query(..., description="Application storage path of the artifact"),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Returns a short-lived (15 minute) signed URL for secure frontend rendering
    of screening images, XAI heatmaps/overlays, and report PDFs.

    Authorization reuses existing screening access rules:
    - Patient: must own the screening session.
    - Dentist: must be verified with an active clinical relationship.
    - Admin: platform oversight access.

    Path safety: the requested path is validated against the database records
    for this specific screening to prevent path traversal attacks.
    """
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.screening import Screening
    from app.models.screening_image import ScreeningImage
    from app.models.ai_prediction import AIPrediction
    from app.models.xai_result import XAIResult
    from app.models.report import Report
    from app.services.storage_service import StorageService

    await enforce_rate_limit(request, scope="artifact_ops", user_id=current_user.id)

    # 1. Load screening with related artifacts
    stmt = (
        select(Screening)
        .where(
            Screening.id == screening_id,
            Screening.is_deleted.is_(False),
        )
        .options(
            selectinload(Screening.images),
            selectinload(Screening.ai_predictions).selectinload(AIPrediction.xai_results),
            selectinload(Screening.report),
        )
    )
    result = await db.execute(stmt)
    screening = result.scalar_one_or_none()

    if screening is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Screening '{screening_id}' not found.",
        )

    # 2. Authorize using existing screening access control
    try:
        await DentistAssessmentService.verify_assessment_view_access(db, current_user, screening)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))

    # 3. Validate path against known database records for this screening
    valid_paths = set()

    # Screening image paths
    for img in (screening.images or []):
        if img.storage_path:
            valid_paths.add(img.storage_path)

    # XAI artifact paths
    for pred in (screening.ai_predictions or []):
        for xai in (pred.xai_results or []):
            if xai.heatmap_storage_path:
                valid_paths.add(xai.heatmap_storage_path)
            if xai.overlay_image_storage_path:
                valid_paths.add(xai.overlay_image_storage_path)

    # Report PDF path
    if screening.report and screening.report.pdf_storage_path:
        valid_paths.add(screening.report.pdf_storage_path)

    if path not in valid_paths:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requested artifact path is not associated with this screening.",
        )

    # 4. Generate signed URL
    signed_url = StorageService.create_signed_url(path, expires_in=900)

    if signed_url is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Storage service is not configured. Cannot generate artifact URL.",
        )

    return {
        "signed_url": signed_url,
        "storage_path": path,
        "expires_in": 900,
    }
