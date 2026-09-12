"""
OraVisionAI — Admin Analytics & Audit Service

Encapsulates asynchronous database-side aggregation queries and audit log inspection logic
for platform administration, operational telemetry, clinical workflow metrics, and AI model registry oversight.
"""

from __future__ import annotations

import datetime
import math
import uuid
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.ai_model import AIModel
from app.models.ai_prediction import AIPrediction
from app.models.appointment import Appointment
from app.models.audit_log import AuditLog
from app.models.consultation import Consultation
from app.models.conversation import Conversation
from app.models.dentist_assessment import DentistAssessment
from app.models.dentist_verification import DentistVerification
from app.models.message import Message
from app.models.report import Report
from app.models.risk_assessment import RiskAssessment
from app.models.screening import Screening
from app.models.screening_image import ScreeningImage
from app.models.user import User
from app.models.yolo_detection import YOLODetection
from app.models.xai_result import XAIResult
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


# Authoritative 7-Class AI Taxonomy mapping
AUTHORITATIVE_7_CLASSES: Dict[str, str] = {
    "CaS": "Canker Sore",
    "CoS": "Cold Sore",
    "Gum": "Gum Disease",
    "MC": "Mucocele",
    "OC": "Oral Cancer",
    "OLP": "Oral Lichen Planus",
    "OT": "Oral Thrush",
}

# Authoritative 4 Risk Levels
AUTHORITATIVE_RISK_LEVELS: List[str] = [
    "low",
    "moderate",
    "high",
    "critical",
]

# Authoritative 7 Appointment Statuses
AUTHORITATIVE_APPOINTMENT_STATUSES: List[str] = [
    "requested",
    "confirmed",
    "in_progress",
    "completed",
    "cancelled",
    "rescheduled",
    "no_show",
]

# Authoritative 4 Consultation Statuses
AUTHORITATIVE_CONSULTATION_STATUSES: List[str] = [
    "scheduled",
    "active",
    "ended",
    "failed",
]

# Authoritative 5 Screening Statuses
AUTHORITATIVE_SCREENING_STATUSES: List[str] = [
    "pending",
    "uploading",
    "processing",
    "completed",
    "failed",
]

SENSITIVE_KEYS = {
    "password",
    "token",
    "firebase_token",
    "authorization",
    "secret",
    "private_key",
    "access_token",
    "refresh_token",
}


def _redact_details(details: Any) -> Any:
    """Recursively redacts sensitive keys from audit log details."""
    if isinstance(details, dict):
        redacted = {}
        for k, v in details.items():
            if any(s in k.lower() for s in SENSITIVE_KEYS):
                redacted[k] = "[REDACTED]"
            else:
                redacted[k] = _redact_details(v)
        return redacted
    elif isinstance(details, list):
        return [_redact_details(item) for item in details]
    return details


class AdminAnalyticsService:
    @staticmethod
    async def list_audit_logs(
        db: AsyncSession,
        user_id: Optional[uuid.UUID] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        start_date: Optional[datetime.datetime] = None,
        end_date: Optional[datetime.datetime] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> AdminAuditLogListResponse:
        """Paginated, filtered query of the immutable audit trail with newest-first ordering."""
        if start_date is not None and end_date is not None and start_date > end_date:
            raise ValueError("start_date cannot be after end_date")

        page = max(1, page)
        page_size = max(1, min(page_size, 100))
        offset = (page - 1) * page_size

        count_stmt = select(func.count(AuditLog.id))
        query_stmt = (
            select(AuditLog)
            .options(selectinload(AuditLog.user))
            .order_by(AuditLog.timestamp.desc(), AuditLog.id.desc())
        )

        if user_id is not None:
            count_stmt = count_stmt.where(AuditLog.user_id == user_id)
            query_stmt = query_stmt.where(AuditLog.user_id == user_id)

        if action is not None:
            count_stmt = count_stmt.where(AuditLog.action == action)
            query_stmt = query_stmt.where(AuditLog.action == action)

        if resource_type is not None:
            count_stmt = count_stmt.where(AuditLog.resource_type == resource_type)
            query_stmt = query_stmt.where(AuditLog.resource_type == resource_type)

        if start_date is not None:
            count_stmt = count_stmt.where(AuditLog.timestamp >= start_date)
            query_stmt = query_stmt.where(AuditLog.timestamp >= start_date)

        if end_date is not None:
            count_stmt = count_stmt.where(AuditLog.timestamp <= end_date)
            query_stmt = query_stmt.where(AuditLog.timestamp <= end_date)

        total = (await db.execute(count_stmt)).scalar() or 0
        rows = (await db.execute(query_stmt.offset(offset).limit(page_size))).scalars().all()

        items: List[AdminAuditLogResponse] = []
        for log in rows:
            u_email = log.user.email if log.user else None
            u_role = log.user.role if log.user else None
            items.append(
                AdminAuditLogResponse(
                    id=log.id,
                    user_id=log.user_id,
                    actor_email=u_email,
                    actor_role=u_role,
                    action=log.action,
                    resource_type=log.resource_type,
                    resource_id=log.resource_id,
                    details=_redact_details(log.details),
                    ip_address=log.ip_address,
                    user_agent=log.user_agent,
                    timestamp=log.timestamp,
                )
            )

        total_pages = math.ceil(total / page_size) if total > 0 else 1

        return AdminAuditLogListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    @staticmethod
    async def get_audit_log_by_id(
        db: AsyncSession,
        audit_log_id: uuid.UUID,
    ) -> Optional[AdminAuditLogResponse]:
        """Fetch a specific audit log record by UUID with sensitive detail redaction."""
        stmt = (
            select(AuditLog)
            .where(AuditLog.id == audit_log_id)
            .options(selectinload(AuditLog.user))
        )
        log = (await db.execute(stmt)).scalar_one_or_none()
        if log is None:
            return None

        u_email = log.user.email if log.user else None
        u_role = log.user.role if log.user else None

        return AdminAuditLogResponse(
            id=log.id,
            user_id=log.user_id,
            actor_email=u_email,
            actor_role=u_role,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            details=_redact_details(log.details),
            ip_address=log.ip_address,
            user_agent=log.user_agent,
            timestamp=log.timestamp,
        )

    @staticmethod
    async def get_platform_overview(db: AsyncSession) -> PlatformOverviewAnalyticsResponse:
        """Compute platform-level aggregate operational metrics across all domains."""
        now = datetime.datetime.now(datetime.timezone.utc)

        # Users overview
        total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
        active_users = (await db.execute(select(func.count(User.id)).where(User.is_active == True))).scalar() or 0
        inactive_users = (await db.execute(select(func.count(User.id)).where(User.is_active == False))).scalar() or 0
        patient_count = (await db.execute(select(func.count(User.id)).where(User.role == "patient"))).scalar() or 0
        dentist_count = (await db.execute(select(func.count(User.id)).where(User.role == "dentist"))).scalar() or 0
        admin_count = (await db.execute(select(func.count(User.id)).where(User.role == "admin"))).scalar() or 0

        # Dentist verifications overview
        total_verifs = (await db.execute(select(func.count(DentistVerification.id)))).scalar() or 0
        pending_verifs = (await db.execute(select(func.count(DentistVerification.id)).where(DentistVerification.status == "pending"))).scalar() or 0
        approved_verifs = (await db.execute(select(func.count(DentistVerification.id)).where(DentistVerification.status == "approved"))).scalar() or 0
        rejected_verifs = (await db.execute(select(func.count(DentistVerification.id)).where(DentistVerification.status == "rejected"))).scalar() or 0

        # Screenings overview (non-deleted)
        total_screenings = (await db.execute(select(func.count(Screening.id)).where(Screening.is_deleted == False))).scalar() or 0
        pending_sc = (await db.execute(select(func.count(Screening.id)).where(Screening.is_deleted == False, Screening.status == "pending"))).scalar() or 0
        processing_sc = (await db.execute(select(func.count(Screening.id)).where(Screening.is_deleted == False, Screening.status == "processing"))).scalar() or 0
        completed_sc = (await db.execute(select(func.count(Screening.id)).where(Screening.is_deleted == False, Screening.status == "completed"))).scalar() or 0
        failed_sc = (await db.execute(select(func.count(Screening.id)).where(Screening.is_deleted == False, Screening.status == "failed"))).scalar() or 0

        # Telehealth overview
        total_appts = (await db.execute(select(func.count(Appointment.id)))).scalar() or 0
        completed_appts = (await db.execute(select(func.count(Appointment.id)).where(Appointment.status == "completed"))).scalar() or 0
        total_cons = (await db.execute(select(func.count(Consultation.id)))).scalar() or 0
        ended_cons = (await db.execute(select(func.count(Consultation.id)).where(Consultation.session_status == "ended"))).scalar() or 0

        # Communication overview
        total_convs = (await db.execute(select(func.count(Conversation.id)))).scalar() or 0
        total_msgs = (await db.execute(select(func.count(Message.id)))).scalar() or 0

        # Audit overview
        total_logs = (await db.execute(select(func.count(AuditLog.id)))).scalar() or 0

        return PlatformOverviewAnalyticsResponse(
            users=UserOverviewMetrics(
                total_users=total_users,
                active_users=active_users,
                inactive_users=inactive_users,
                patient_count=patient_count,
                dentist_count=dentist_count,
                admin_count=admin_count,
            ),
            dentist_verifications=DentistVerificationOverviewMetrics(
                total_verifications=total_verifs,
                pending_verifications=pending_verifs,
                approved_verifications=approved_verifs,
                rejected_verifications=rejected_verifs,
            ),
            screenings=ScreeningOverviewMetrics(
                total_screenings=total_screenings,
                pending_screenings=pending_sc,
                processing_screenings=processing_sc,
                completed_screenings=completed_sc,
                failed_screenings=failed_sc,
            ),
            telehealth=TelehealthOverviewMetrics(
                total_appointments=total_appts,
                completed_appointments=completed_appts,
                total_consultations=total_cons,
                ended_consultations=ended_cons,
            ),
            communication=CommunicationOverviewMetrics(
                total_conversations=total_convs,
                total_messages=total_msgs,
            ),
            total_audit_logs=total_logs,
            generated_at=now,
        )

    @staticmethod
    async def get_screening_analytics(
        db: AsyncSession,
        start_date: Optional[datetime.datetime] = None,
        end_date: Optional[datetime.datetime] = None,
    ) -> ClinicalScreeningAnalyticsResponse:
        """Compute screening workflow metrics anchored strictly to non-deleted screenings in the time window."""
        if start_date is not None and end_date is not None and start_date > end_date:
            raise ValueError("start_date cannot be after end_date")

        now = datetime.datetime.now(datetime.timezone.utc)

        # 1. Anchor: Non-deleted screenings within requested creation window
        cohort_stmt = select(Screening.id).where(Screening.is_deleted == False)
        if start_date is not None:
            cohort_stmt = cohort_stmt.where(Screening.created_at >= start_date)
        if end_date is not None:
            cohort_stmt = cohort_stmt.where(Screening.created_at <= end_date)

        cohort_subq = cohort_stmt.subquery()

        # 2. Total screenings in anchored cohort
        total_screenings = (await db.execute(select(func.count()).select_from(cohort_subq))).scalar() or 0

        # 3. Screening status breakdown
        status_stmt = (
            select(Screening.status, func.count(Screening.id))
            .where(Screening.id.in_(select(cohort_subq.c.id)))
            .group_by(Screening.status)
        )
        status_rows = (await db.execute(status_stmt)).all()
        status_counts: Dict[str, int] = {st: 0 for st in AUTHORITATIVE_SCREENING_STATUSES}
        for st, count in status_rows:
            status_counts[st] = count

        # 4. Risk assessment distribution joined strictly to anchored screening cohort
        risk_stmt = (
            select(RiskAssessment.risk_level, func.count(RiskAssessment.id))
            .where(RiskAssessment.screening_id.in_(select(cohort_subq.c.id)))
            .group_by(RiskAssessment.risk_level)
        )
        risk_rows = (await db.execute(risk_stmt)).all()
        risk_counts: Dict[str, int] = {rl: 0 for rl in AUTHORITATIVE_RISK_LEVELS}
        total_risk_assessments = 0
        for rl, count in risk_rows:
            if rl in risk_counts:
                risk_counts[rl] = count
            else:
                risk_counts[rl] = count
            total_risk_assessments += count

        risk_distribution: List[RiskDistributionItem] = []
        for rl in AUTHORITATIVE_RISK_LEVELS:
            c = risk_counts.get(rl, 0)
            pct = round((c / total_risk_assessments * 100.0), 2) if total_risk_assessments > 0 else 0.0
            risk_distribution.append(RiskDistributionItem(risk_level=rl, count=c, percentage=pct))

        # 5. Dentist assessments joined strictly to anchored screening cohort
        assess_stmt = (
            select(
                func.count(DentistAssessment.id),
                func.coalesce(func.sum(case((DentistAssessment.is_finalized == True, 1), else_=0)), 0),
                func.coalesce(func.sum(case((DentistAssessment.is_finalized == False, 1), else_=0)), 0),
            )
            .where(DentistAssessment.screening_id.in_(select(cohort_subq.c.id)))
        )
        assess_res = (await db.execute(assess_stmt)).one()
        assess_total = int(assess_res[0] or 0)
        assess_finalized = int(assess_res[1] or 0)
        assess_draft = int(assess_res[2] or 0)

        # 6. Generated reports joined strictly to anchored screening cohort
        report_stmt = (
            select(func.count(Report.id))
            .where(Report.screening_id.in_(select(cohort_subq.c.id)))
        )
        reports_generated = (await db.execute(report_stmt)).scalar() or 0

        return ClinicalScreeningAnalyticsResponse(
            total_screenings=total_screenings,
            screening_status_breakdown=status_counts,
            risk_distribution=risk_distribution,
            dentist_assessments=DentistAssessmentMetrics(
                total_assessments=assess_total,
                finalized_count=assess_finalized,
                draft_count=assess_draft,
            ),
            reports_generated=reports_generated,
            start_date=start_date,
            end_date=end_date,
            generated_at=now,
        )

    @staticmethod
    async def get_ai_telemetry(db: AsyncSession) -> AITelemetryAnalyticsResponse:
        """Report operational AI inference telemetry based on persisted prediction records."""
        now = datetime.datetime.now(datetime.timezone.utc)

        # Total predictions
        total_predictions = (await db.execute(select(func.count(AIPrediction.id)))).scalar() or 0

        # Mean predicted confidence
        avg_conf = (await db.execute(select(func.coalesce(func.avg(AIPrediction.confidence), 0.0)))).scalar() or 0.0
        avg_confidence = round(float(avg_conf), 4)

        # Classification distribution across authoritative 7 classes
        class_stmt = (
            select(AIPrediction.predicted_class, func.count(AIPrediction.id))
            .group_by(AIPrediction.predicted_class)
        )
        class_rows = (await db.execute(class_stmt)).all()
        class_counts = {r[0]: r[1] for r in class_rows}

        classification_distribution: List[AIClassTelemetryItem] = []
        for code, name in AUTHORITATIVE_7_CLASSES.items():
            count = class_counts.get(code, 0)
            pct = round((count / total_predictions * 100.0), 2) if total_predictions > 0 else 0.0
            classification_distribution.append(
                AIClassTelemetryItem(
                    class_code=code,
                    class_name=name,
                    count=count,
                    percentage=pct,
                )
            )

        # Total YOLO detections
        total_yolo = (await db.execute(select(func.count(YOLODetection.id)))).scalar() or 0

        # Total screening images
        total_images = (await db.execute(select(func.count(ScreeningImage.id)))).scalar() or 0
        avg_detections_per_image = round((total_yolo / total_images), 2) if total_images > 0 else 0.0

        # Total XAI visual explanation heatmaps
        total_xai = (await db.execute(select(func.count(XAIResult.id)))).scalar() or 0

        # Active models from registry
        models_stmt = select(AIModel).where(AIModel.is_active == True).order_by(AIModel.name)
        active_model_records = (await db.execute(models_stmt)).scalars().all()
        active_models = [
            AIActiveModelSummary(
                name=m.name,
                version=m.version,
                model_type=m.model_type,
                architecture=m.architecture,
                input_shape=m.input_shape,
            )
            for m in active_model_records
        ]

        return AITelemetryAnalyticsResponse(
            total_predictions=total_predictions,
            classification_distribution=classification_distribution,
            average_prediction_confidence=avg_confidence,
            total_yolo_detections=total_yolo,
            average_detections_per_image=avg_detections_per_image,
            total_xai_generations=total_xai,
            active_models=active_models,
            generated_at=now,
        )

    @staticmethod
    async def get_telehealth_analytics(db: AsyncSession) -> TelehealthAnalyticsResponse:
        """Report operational telehealth scheduling and teleconsultation utilization metrics."""
        now = datetime.datetime.now(datetime.timezone.utc)

        # Total appointments
        total_appts = (await db.execute(select(func.count(Appointment.id)))).scalar() or 0

        # Appointment status breakdown
        appt_stmt = (
            select(Appointment.status, func.count(Appointment.id))
            .group_by(Appointment.status)
        )
        appt_rows = (await db.execute(appt_stmt)).all()
        appt_counts: Dict[str, int] = {st: 0 for st in AUTHORITATIVE_APPOINTMENT_STATUSES}
        for st, count in appt_rows:
            appt_counts[st] = count

        cancelled_count = appt_counts.get("cancelled", 0)
        cancellation_rate = round((cancelled_count / total_appts * 100.0), 2) if total_appts > 0 else 0.0

        # Total consultations
        total_cons = (await db.execute(select(func.count(Consultation.id)))).scalar() or 0

        # Consultation status breakdown
        cons_stmt = (
            select(Consultation.session_status, func.count(Consultation.id))
            .group_by(Consultation.session_status)
        )
        cons_rows = (await db.execute(cons_stmt)).all()
        cons_counts: Dict[str, int] = {st: 0 for st in AUTHORITATIVE_CONSULTATION_STATUSES}
        for st, count in cons_rows:
            cons_counts[st] = count

        # Duration metrics for ended consultations
        dur_stmt = (
            select(
                func.coalesce(func.sum(Consultation.duration_seconds), 0),
                func.coalesce(func.avg(Consultation.duration_seconds), 0.0),
            )
            .where(Consultation.session_status == "ended")
        )
        dur_res = (await db.execute(dur_stmt)).one()
        total_duration = int(dur_res[0] or 0)
        avg_duration = round(float(dur_res[1] or 0.0), 2)

        return TelehealthAnalyticsResponse(
            total_appointments=total_appts,
            appointment_status_breakdown=appt_counts,
            appointment_cancellation_rate=cancellation_rate,
            total_consultations=total_cons,
            consultation_status_breakdown=cons_counts,
            total_ended_consultation_duration_seconds=total_duration,
            average_ended_consultation_duration_seconds=avg_duration,
            generated_at=now,
        )

    @staticmethod
    async def list_ai_models(db: AsyncSession) -> AIModelListResponse:
        """Read-only listing of all registered AIModel entities from database, excluding private paths."""
        stmt = select(AIModel).order_by(AIModel.created_at.desc())
        models = (await db.execute(stmt)).scalars().all()
        items = [
            AIModelResponse(
                id=m.id,
                name=m.name,
                model_type=m.model_type,
                version=m.version,
                architecture=m.architecture,
                input_shape=m.input_shape,
                class_labels=m.class_labels or [],
                target_layers=m.target_layers or [],
                is_active=m.is_active,
                created_at=m.created_at,
            )
            for m in models
        ]
        return AIModelListResponse(items=items, total=len(items))

    @staticmethod
    async def get_ai_model_by_id(
        db: AsyncSession,
        model_id: uuid.UUID,
    ) -> Optional[AIModelResponse]:
        """Fetch a specific registered AIModel record by UUID without exposing internal weights_path."""
        stmt = select(AIModel).where(AIModel.id == model_id)
        m = (await db.execute(stmt)).scalar_one_or_none()
        if m is None:
            return None

        return AIModelResponse(
            id=m.id,
            name=m.name,
            model_type=m.model_type,
            version=m.version,
            architecture=m.architecture,
            input_shape=m.input_shape,
            class_labels=m.class_labels or [],
            target_layers=m.target_layers or [],
            is_active=m.is_active,
            created_at=m.created_at,
        )
