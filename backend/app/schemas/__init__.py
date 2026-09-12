"""
OraVisionAI — Unified Schemas Package

Exports all Pydantic schemas for authentication, user management, patient profiles,
dentist verifications, admin auditing, screening lifecycles, AI inference, XAI explanations,
and clinical report generation.
"""

from app.schemas.admin import (
    AdminDentistVerificationResponse,
    AdminUserListResponse,
    AdminUserResponse,
    AdminVerificationListResponse,
    UserStatusUpdate,
    VerificationReviewRequest,
)
from app.schemas.ai import (
    BoundingBox,
    ClassificationResult,
    DetectionItem,
    ImageInferenceResult,
    ProbabilityItem,
    ScreeningInferenceResponse,
)
from app.schemas.dentist import (
    DentistBase,
    DentistResponse,
    DentistUpdate,
    DentistVerificationBase,
    DentistVerificationCreate,
    DentistVerificationResponse,
)
from app.schemas.patient import (
    PatientBase,
    PatientMedicalProfileBase,
    PatientMedicalProfileCreate,
    PatientMedicalProfileResponse,
    PatientMedicalProfileUpdate,
    PatientResponse,
    PatientUpdate,
)
from app.schemas.report import (
    ReportDownloadResponse,
    ReportGenerateRequest,
    ReportResponse,
    ReportSummaryResponse,
)
from app.schemas.screening import (
    ScreeningCreate,
    ScreeningDeleteResponse,
    ScreeningDetailResponse,
    ScreeningImageResponse,
    ScreeningListResponse,
    ScreeningResponse,
)
from app.schemas.user import (
    RoleAccessResponse,
    UserBase,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from app.schemas.risk_assessment import (
    ContributingFactorItem,
    RiskAssessmentRequest,
    RiskAssessmentResponse,
)
from app.schemas.xai import (
    ScreeningXAIResponse,
    XAIAvailableMethodsResponse,
    XAIGenerationRequest,
    XAIMethodInfo,
    XAIResultResponse,
)
from app.schemas.dentist_assessment import (
    DentistAssessmentCreate,
    DentistAssessmentResponse,
    DentistAssessmentUpdate,
    ScreeningReviewResponse,
)
from app.schemas.dentist_availability import (
    DentistAvailabilityCreate,
    DentistAvailabilityListResponse,
    DentistAvailabilityResponse,
    DentistAvailabilityUpdate,
)
from app.schemas.appointment import (
    AppointmentCancel,
    AppointmentCreate,
    AppointmentListResponse,
    AppointmentResponse,
    AppointmentStatusUpdate,
)

__all__ = [
    "UserBase",
    "UserCreate",
    "UserUpdate",
    "UserResponse",
    "RoleAccessResponse",
    "PatientBase",
    "PatientUpdate",
    "PatientResponse",
    "PatientMedicalProfileBase",
    "PatientMedicalProfileCreate",
    "PatientMedicalProfileUpdate",
    "PatientMedicalProfileResponse",
    "DentistBase",
    "DentistUpdate",
    "DentistResponse",
    "DentistVerificationBase",
    "DentistVerificationCreate",
    "DentistVerificationResponse",
    "UserStatusUpdate",
    "AdminUserResponse",
    "AdminUserListResponse",
    "VerificationReviewRequest",
    "AdminDentistVerificationResponse",
    "AdminVerificationListResponse",
    "ScreeningCreate",
    "ScreeningResponse",
    "ScreeningDetailResponse",
    "ScreeningListResponse",
    "ScreeningImageResponse",
    "ScreeningDeleteResponse",
    "ProbabilityItem",
    "ClassificationResult",
    "BoundingBox",
    "DetectionItem",
    "ImageInferenceResult",
    "ScreeningInferenceResponse",
    "XAIMethodInfo",
    "XAIAvailableMethodsResponse",
    "XAIResultResponse",
    "XAIGenerationRequest",
    "ScreeningXAIResponse",
    "ReportGenerateRequest",
    "ReportSummaryResponse",
    "ReportResponse",
    "ReportDownloadResponse",
    "ContributingFactorItem",
    "RiskAssessmentRequest",
    "RiskAssessmentResponse",
    "DentistAssessmentCreate",
    "DentistAssessmentUpdate",
    "DentistAssessmentResponse",
    "ScreeningReviewResponse",
    "DentistAvailabilityCreate",
    "DentistAvailabilityUpdate",
    "DentistAvailabilityResponse",
    "DentistAvailabilityListResponse",
    "AppointmentCreate",
    "AppointmentStatusUpdate",
    "AppointmentCancel",
    "AppointmentResponse",
    "AppointmentListResponse",
]

from app.schemas.conversation import (
    ConversationArchive,
    ConversationCreate,
    ConversationListResponse,
    ConversationResponse,
)
from app.schemas.message import (
    MessageCreate,
    MessageListResponse,
    MessageReadResponse,
    MessageResponse,
)

from app.schemas.notification import (
    NotificationListResponse,
    NotificationReadAllResponse,
    NotificationResponse,
    NotificationUnreadCountResponse,
)

from app.schemas.analytics import (
    AdminAuditLogListResponse,
    AdminAuditLogResponse,
    AIActiveModelSummary,
    AIClassTelemetryItem,
    AIModelListResponse,
    AIModelResponse,
    AITelemetryAnalyticsResponse,
    ClinicalScreeningAnalyticsResponse,
    CommunicationOverviewMetrics,
    DentistAssessmentMetrics,
    DentistVerificationOverviewMetrics,
    PlatformOverviewAnalyticsResponse,
    RiskDistributionItem,
    ScreeningOverviewMetrics,
    TelehealthAnalyticsResponse,
    TelehealthOverviewMetrics,
    UserOverviewMetrics,
)
