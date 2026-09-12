"""
OraVisionAI — Admin API Endpoints

Provides administrative endpoints for platform user management, dentist verification reviews, and audit oversight.
Restricted exclusively to authorized administrators (require_admin).
"""

import datetime
import math
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.admin import (
    AdminDentistVerificationResponse,
    AdminUserListResponse,
    AdminUserResponse,
    AdminVerificationListResponse,
    UserStatusUpdate,
    VerificationReviewRequest,
)
from app.services.admin_service import AdminService

router = APIRouter(prefix="/admin", tags=["Admin"])


def _build_admin_user_response(user: User) -> AdminUserResponse:
    has_patient = user.patient is not None
    has_dentist = user.dentist is not None
    dentist_status = user.dentist.verification_status if has_dentist else None

    return AdminUserResponse(
        id=user.id,
        firebase_uid=user.firebase_uid,
        email=user.email,
        role=user.role,
        first_name=user.first_name,
        last_name=user.last_name,
        phone_number=user.phone_number,
        avatar_url=user.avatar_url,
        is_active=user.is_active,
        is_email_verified=user.is_email_verified,
        has_patient_profile=has_patient,
        has_dentist_profile=has_dentist,
        dentist_verification_status=dentist_status,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def _build_admin_verification_response(v) -> AdminDentistVerificationResponse:
    dentist = v.dentist
    d_user = dentist.user if dentist else None
    d_name = f"{d_user.first_name} {d_user.last_name}".strip() if d_user else None
    d_email = d_user.email if d_user else None
    license_no = dentist.license_number if dentist else None
    spec = dentist.specialization if dentist else None

    return AdminDentistVerificationResponse(
        id=v.id,
        dentist_id=v.dentist_id,
        dentist_user_id=d_user.id if d_user else None,
        dentist_name=d_name,
        dentist_email=d_email,
        license_number=license_no,
        specialization=spec,
        document_type=v.document_type,
        document_url=v.document_url,
        file_name=v.file_name,
        file_size_bytes=v.file_size_bytes,
        status=v.status,
        reviewer_id=v.reviewer_id,
        review_notes=v.review_notes,
        submitted_at=v.submitted_at,
        reviewed_at=v.reviewed_at,
    )


@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    role: Optional[str] = Query(None, description="Filter users by role ('patient', 'dentist', 'admin')"),
    is_active: Optional[bool] = Query(None, description="Filter users by active status"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserListResponse:
    users, total = await AdminService.list_users(
        db=db,
        role=role,
        is_active=is_active,
        page=page,
        page_size=page_size,
    )
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return AdminUserListResponse(
        items=[_build_admin_user_response(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/users/{user_id}", response_model=AdminUserResponse)
async def get_user_detail(
    user_id: uuid.UUID,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserResponse:
    user = await AdminService.get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} was not found.",
        )
    return _build_admin_user_response(user)


@router.patch("/users/{user_id}/status", response_model=AdminUserResponse)
async def update_user_status(
    user_id: uuid.UUID,
    status_data: UserStatusUpdate,
    request: Request,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserResponse:
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        updated_user = await AdminService.update_user_status(
            db=db,
            admin_user=current_admin,
            target_user_id=user_id,
            new_status=status_data.is_active,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return _build_admin_user_response(updated_user)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.get("/dentist-verifications", response_model=AdminVerificationListResponse)
async def list_dentist_verifications(
    status_filter: Optional[str] = Query(
        None,
        alias="status",
        description="Filter verifications by status ('pending', 'approved', 'rejected')",
    ),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminVerificationListResponse:
    verifications, total = await AdminService.list_dentist_verifications(
        db=db,
        status=status_filter,
        page=page,
        page_size=page_size,
    )
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    return AdminVerificationListResponse(
        items=[_build_admin_verification_response(v) for v in verifications],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get(
    "/dentist-verifications/{verification_id}",
    response_model=AdminDentistVerificationResponse,
)
async def get_dentist_verification_detail(
    verification_id: uuid.UUID,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminDentistVerificationResponse:
    verification = await AdminService.get_dentist_verification_by_id(db, verification_id)
    if verification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Verification submission {verification_id} was not found.",
        )
    return _build_admin_verification_response(verification)


@router.post(
    "/dentist-verifications/{verification_id}/approve",
    response_model=AdminDentistVerificationResponse,
)
async def approve_dentist_verification(
    verification_id: uuid.UUID,
    request: Request,
    review_data: Optional[VerificationReviewRequest] = None,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminDentistVerificationResponse:
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    notes = review_data.review_notes if review_data else None

    try:
        verification = await AdminService.approve_dentist_verification(
            db=db,
            admin_user=current_admin,
            verification_id=verification_id,
            review_notes=notes,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return _build_admin_verification_response(verification)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )


@router.post(
    "/dentist-verifications/{verification_id}/reject",
    response_model=AdminDentistVerificationResponse,
)
async def reject_dentist_verification(
    verification_id: uuid.UUID,
    request: Request,
    review_data: Optional[VerificationReviewRequest] = None,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminDentistVerificationResponse:
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    notes = review_data.review_notes if review_data else None

    try:
        verification = await AdminService.reject_dentist_verification(
            db=db,
            admin_user=current_admin,
            verification_id=verification_id,
            review_notes=notes,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return _build_admin_verification_response(verification)
    except LookupError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )


# =============================================================================
# Phase 18: Platform Administration, Audit Oversight & Clinical Analytics
# =============================================================================

from app.schemas.analytics import (
    AdminAuditLogListResponse,
    AdminAuditLogResponse,
    AIModelListResponse,
    AIModelResponse,
    AITelemetryAnalyticsResponse,
    ClinicalScreeningAnalyticsResponse,
    PlatformOverviewAnalyticsResponse,
    TelehealthAnalyticsResponse,
)
from app.services.admin_analytics_service import AdminAnalyticsService


@router.get(
    "/audit-logs",
    response_model=AdminAuditLogListResponse,
    summary="List audit logs",
)
async def list_audit_logs(
    request: Request,
    user_id: Optional[uuid.UUID] = Query(None, description="Filter by actor user ID"),
    action: Optional[str] = Query(None, description="Filter by audit action"),
    resource_type: Optional[str] = Query(None, description="Filter by target resource type"),
    start_date: Optional[datetime.datetime] = Query(None, description="Filter events on or after timestamp"),
    end_date: Optional[datetime.datetime] = Query(None, description="Filter events on or before timestamp"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminAuditLogListResponse:
    """Paginated, filtered inspection of the immutable security and compliance audit trail."""
    try:
        # Compute query snapshot before appending the access log
        result = await AdminAnalyticsService.list_audit_logs(
            db=db,
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            start_date=start_date,
            end_date=end_date,
            page=page,
            page_size=page_size,
        )

        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        await AdminService.create_audit_log(
            db=db,
            user_id=current_admin.id,
            action="AUDIT_LOGS_VIEWED",
            resource_type="audit_log",
            resource_id=None,
            details={
                "page": page,
                "page_size": page_size,
                "filter_user_id": str(user_id) if user_id else None,
                "filter_action": action,
                "filter_resource": resource_type,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get(
    "/audit-logs/{audit_log_id}",
    response_model=AdminAuditLogResponse,
    summary="Get audit log details",
)
async def get_audit_log_detail(
    audit_log_id: uuid.UUID,
    request: Request,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminAuditLogResponse:
    """Inspect an individual audit log entry with sensitive credentials redacted."""
    log_response = await AdminAnalyticsService.get_audit_log_by_id(db, audit_log_id)
    if log_response is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audit log entry with ID {audit_log_id} was not found.",
        )

    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await AdminService.create_audit_log(
        db=db,
        user_id=current_admin.id,
        action="AUDIT_LOG_DETAIL_VIEWED",
        resource_type="audit_log",
        resource_id=str(audit_log_id),
        details={"inspected_action": log_response.action},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return log_response


@router.get(
    "/analytics/overview",
    response_model=PlatformOverviewAnalyticsResponse,
    summary="Get platform overview analytics",
)
async def get_platform_overview(
    request: Request,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> PlatformOverviewAnalyticsResponse:
    """Retrieve platform-wide operational KPIs and aggregate statistics."""
    analytics = await AdminAnalyticsService.get_platform_overview(db)
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await AdminService.create_audit_log(
        db=db,
        user_id=current_admin.id,
        action="PLATFORM_ANALYTICS_VIEWED",
        resource_type="analytics",
        resource_id=None,
        details=None,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return analytics


@router.get(
    "/analytics/screenings",
    response_model=ClinicalScreeningAnalyticsResponse,
    summary="Get screening workflow analytics",
)
async def get_screening_analytics(
    request: Request,
    start_date: Optional[datetime.datetime] = Query(None, description="Filter cohort created on or after timestamp"),
    end_date: Optional[datetime.datetime] = Query(None, description="Filter cohort created on or before timestamp"),
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> ClinicalScreeningAnalyticsResponse:
    """Retrieve aggregate screening workflow metrics strictly anchored to the non-deleted screening cohort."""
    try:
        analytics = await AdminAnalyticsService.get_screening_analytics(
            db=db,
            start_date=start_date,
            end_date=end_date,
        )
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        await AdminService.create_audit_log(
            db=db,
            user_id=current_admin.id,
            action="CLINICAL_ANALYTICS_VIEWED",
            resource_type="analytics",
            resource_id=None,
            details={
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return analytics
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get(
    "/analytics/ai-telemetry",
    response_model=AITelemetryAnalyticsResponse,
    summary="Get AI inference telemetry",
)
async def get_ai_telemetry(
    request: Request,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AITelemetryAnalyticsResponse:
    """Retrieve operational AI inference telemetry, 7-class distribution, and YOLO/XAI counts."""
    analytics = await AdminAnalyticsService.get_ai_telemetry(db)
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await AdminService.create_audit_log(
        db=db,
        user_id=current_admin.id,
        action="AI_ANALYTICS_VIEWED",
        resource_type="analytics",
        resource_id=None,
        details=None,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return analytics


@router.get(
    "/analytics/telehealth",
    response_model=TelehealthAnalyticsResponse,
    summary="Get telehealth utilization analytics",
)
async def get_telehealth_analytics(
    request: Request,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> TelehealthAnalyticsResponse:
    """Retrieve operational appointment scheduling and live teleconsultation utilization metrics."""
    analytics = await AdminAnalyticsService.get_telehealth_analytics(db)
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await AdminService.create_audit_log(
        db=db,
        user_id=current_admin.id,
        action="TELEHEALTH_ANALYTICS_VIEWED",
        resource_type="analytics",
        resource_id=None,
        details=None,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return analytics


@router.get(
    "/ai-models",
    response_model=AIModelListResponse,
    summary="List registered AI models",
)
async def list_ai_models(
    request: Request,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AIModelListResponse:
    """Read-only catalog inspection of registered versioned AIModel entities."""
    models_response = await AdminAnalyticsService.list_ai_models(db)
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await AdminService.create_audit_log(
        db=db,
        user_id=current_admin.id,
        action="AI_MODELS_CATALOG_VIEWED",
        resource_type="ai_model",
        resource_id=None,
        details=None,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return models_response


@router.get(
    "/ai-models/{model_id}",
    response_model=AIModelResponse,
    summary="Get registered AI model detail",
)
async def get_ai_model_detail(
    model_id: uuid.UUID,
    request: Request,
    current_admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AIModelResponse:
    """Inspect architectural metadata of a registered AI model without exposing filesystem paths."""
    model_response = await AdminAnalyticsService.get_ai_model_by_id(db, model_id)
    if model_response is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AI model with ID {model_id} was not found.",
        )
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await AdminService.create_audit_log(
        db=db,
        user_id=current_admin.id,
        action="AI_MODELS_CATALOG_VIEWED",
        resource_type="ai_model",
        resource_id=str(model_id),
        details={"model_name": model_response.name, "version": model_response.version},
        ip_address=ip_address,
        user_agent=user_agent,
    )
    return model_response
