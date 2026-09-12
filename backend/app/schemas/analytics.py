"""
OraVisionAI — Administrative Analytics & Audit Pydantic Schemas

Strict data transfer objects for platform oversight, audit trail querying,
screening workflow analytics, AI inference telemetry, telehealth utilization,
and AI model registry metadata.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


# =============================================================================
# Audit Log Schemas
# =============================================================================


class AdminAuditLogResponse(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    actor_email: Optional[str] = None
    actor_role: Optional[str] = None
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime.datetime

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class AdminAuditLogListResponse(BaseModel):
    items: List[AdminAuditLogResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

    model_config = ConfigDict(extra="forbid")


# =============================================================================
# Platform Overview Analytics Schemas
# =============================================================================


class UserOverviewMetrics(BaseModel):
    total_users: int
    active_users: int
    inactive_users: int
    patient_count: int
    dentist_count: int
    admin_count: int

    model_config = ConfigDict(extra="forbid")


class DentistVerificationOverviewMetrics(BaseModel):
    total_verifications: int
    pending_verifications: int
    approved_verifications: int
    rejected_verifications: int

    model_config = ConfigDict(extra="forbid")


class ScreeningOverviewMetrics(BaseModel):
    total_screenings: int
    pending_screenings: int
    processing_screenings: int
    completed_screenings: int
    failed_screenings: int

    model_config = ConfigDict(extra="forbid")


class TelehealthOverviewMetrics(BaseModel):
    total_appointments: int
    completed_appointments: int
    total_consultations: int
    ended_consultations: int

    model_config = ConfigDict(extra="forbid")


class CommunicationOverviewMetrics(BaseModel):
    total_conversations: int
    total_messages: int

    model_config = ConfigDict(extra="forbid")


class PlatformOverviewAnalyticsResponse(BaseModel):
    users: UserOverviewMetrics
    dentist_verifications: DentistVerificationOverviewMetrics
    screenings: ScreeningOverviewMetrics
    telehealth: TelehealthOverviewMetrics
    communication: CommunicationOverviewMetrics
    total_audit_logs: int
    generated_at: datetime.datetime

    model_config = ConfigDict(extra="forbid")


# =============================================================================
# Screening Workflow Analytics Schemas
# =============================================================================


class RiskDistributionItem(BaseModel):
    risk_level: str  # low, moderate, high, critical
    count: int
    percentage: float

    model_config = ConfigDict(extra="forbid")


class DentistAssessmentMetrics(BaseModel):
    total_assessments: int
    finalized_count: int
    draft_count: int

    model_config = ConfigDict(extra="forbid")


class ClinicalScreeningAnalyticsResponse(BaseModel):
    total_screenings: int
    screening_status_breakdown: Dict[str, int]
    risk_distribution: List[RiskDistributionItem]
    dentist_assessments: DentistAssessmentMetrics
    reports_generated: int
    start_date: Optional[datetime.datetime] = None
    end_date: Optional[datetime.datetime] = None
    generated_at: datetime.datetime

    model_config = ConfigDict(extra="forbid")


# =============================================================================
# AI Telemetry Analytics Schemas
# =============================================================================


class AIClassTelemetryItem(BaseModel):
    class_code: str  # CaS, CoS, Gum, MC, OC, OLP, OT
    class_name: str  # Canker Sore, Cold Sore, Gum Disease, etc.
    count: int
    percentage: float

    model_config = ConfigDict(extra="forbid")


class AIActiveModelSummary(BaseModel):
    name: str
    version: str
    model_type: str
    architecture: str
    input_shape: str

    model_config = ConfigDict(extra="forbid")


class AITelemetryAnalyticsResponse(BaseModel):
    total_predictions: int
    classification_distribution: List[AIClassTelemetryItem]
    average_prediction_confidence: float
    total_yolo_detections: int
    average_detections_per_image: float
    total_xai_generations: int
    active_models: List[AIActiveModelSummary]
    generated_at: datetime.datetime

    model_config = ConfigDict(extra="forbid")


# =============================================================================
# Telehealth Analytics Schemas
# =============================================================================


class TelehealthAnalyticsResponse(BaseModel):
    total_appointments: int
    appointment_status_breakdown: Dict[str, int]
    appointment_cancellation_rate: float
    total_consultations: int
    consultation_status_breakdown: Dict[str, int]
    total_ended_consultation_duration_seconds: int
    average_ended_consultation_duration_seconds: float
    generated_at: datetime.datetime

    model_config = ConfigDict(extra="forbid")


# =============================================================================
# AI Model Registry Schemas
# =============================================================================


class AIModelResponse(BaseModel):
    id: uuid.UUID
    name: str
    model_type: str
    version: str
    architecture: str
    input_shape: str
    class_labels: List[Any]
    target_layers: Optional[List[Any]] = None
    is_active: bool
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True, extra="forbid")


class AIModelListResponse(BaseModel):
    items: List[AIModelResponse]
    total: int

    model_config = ConfigDict(extra="forbid")
