/**
 * OraVisionAI - Screening Domain Types & Schemas
 *
 * Strictly maps to FastAPI Pydantic models:
 * - app.schemas.screening
 * - app.schemas.ai
 * - app.schemas.xai
 * - app.schemas.risk_assessment
 * - app.schemas.report
 * - app.schemas.dentist_assessment
 */

import { LesionClassCode, RiskLevel, ScreeningStatus, XaiMethod } from './domain';

// ============================================================================
// Screening Session Schemas
// ============================================================================

export interface ScreeningCreate {
  clinical_notes?: string | null;
}

export interface ScreeningResponse {
  id: string; // UUID
  patient_id: string; // UUID
  created_by_id: string; // UUID
  status: ScreeningStatus;
  clinical_notes?: string | null;
  error_message?: string | null;
  is_deleted: boolean;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

export interface ScreeningDeleteResponse {
  success: boolean;
  message: string;
  screening_id: string;
}

export interface ScreeningImageResponse {
  id: string;
  screening_id: string;
  storage_path: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  image_width?: number | null;
  image_height?: number | null;
  image_sha256?: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface ScreeningDetailResponse extends ScreeningResponse {
  images: ScreeningImageResponse[];
}

export interface ScreeningListResponse {
  items: ScreeningResponse[];
  total: number;
  page: number;
  page_size: number;
}

// ============================================================================
// AI Classification & YOLO Detection Schemas
// ============================================================================

export interface ProbabilityItem {
  class_index: number;
  class_code: LesionClassCode;
  class_name: string;
  probability: number; // Model class score [0.0, 1.0]
}

export interface ClassificationResult {
  predicted_class: string;
  predicted_code?: LesionClassCode | null;
  confidence: number; // Model confidence score [0.0, 1.0]
  probabilities: ProbabilityItem[];
}

export interface BoundingBox {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}

export interface DetectionItem {
  id?: string;
  class_name?: string;
  detected_class?: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface ImageInferenceResult {
  screening_image_id: string;
  classification?: ClassificationResult | null;
  detections: DetectionItem[];
  inference_duration_ms?: number | null;
}

export interface ScreeningInferenceResponse {
  screening_id: string;
  status: string;
  total_images_processed: number;
  results: ImageInferenceResult[];
}

// ============================================================================
// Explainable AI (XAI) Schemas
// ============================================================================

export interface XAIResultResponse {
  id: string;
  ai_prediction_id: string;
  screening_image_id: string;
  method: XaiMethod;
  target_layer?: string | null; // Authoritative target layer: block6a_expand_conv
  is_primary_user_facing: boolean;
  heatmap_storage_path: string;
  overlay_image_storage_path: string;
  parameters?: Record<string, unknown> | null;
  created_at: string;
}

export interface ScreeningXAIResponse {
  screening_id: string;
  total_results: number;
  results: XAIResultResponse[];
}

export interface XAIGenerationRequest {
  include_secondary?: boolean;
  force_recompute?: boolean;
  methods?: string[] | null;
}

// ============================================================================
// Clinical Context & Risk Assessment Schemas
// ============================================================================

export interface ContributingFactorItem {
  category: string;
  observation: string;
  source: string;
}

export interface RiskAssessmentResponse {
  id: string;
  screening_id: string;
  ai_prediction_id?: string | null;
  risk_level: RiskLevel;
  risk_score: number; // Technical ordinal tier index: 25.0, 50.0, 75.0, 100.0
  contributing_factors: ContributingFactorItem[];
  summary: string;
  recommended_action: string;
  created_at: string;
  engine_version: string;
  disclaimer: string;
}

export interface RiskAssessmentRequest {
  force_recompute?: boolean;
}

// ============================================================================
// Clinical Report Schemas
// ============================================================================

export interface ReportResponse {
  id: string;
  screening_id: string;
  report_number: string;
  generated_by_id?: string | null;
  report_title: string;
  summary?: string | null;
  report_data: Record<string, unknown>;
  pdf_storage_path?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportGenerateRequest {
  force_regenerate?: boolean;
  report_title?: string;
}

// ============================================================================
// Dentist Clinical Review Schemas
// ============================================================================

export interface DentistAssessmentSummary {
  id: string;
  screening_id?: string;
  dentist_id?: string;
  clinical_observations: string;
  diagnosis_notes: string;
  treatment_recommendation: string;
  referral_needed: boolean;
  referral_specialty?: string | null;
  is_finalized: boolean;
  finalized_at?: string | null;
  created_at?: string;
  updated_at?: string;
  dentist_name?: string | null;
  dentist_clinic?: string | null;
  dentist_license?: string | null;
}

export interface ScreeningReviewResponse {
  screening_id: string;
  patient_id: string;
  patient_name: string;
  patient_age?: number | null;
  patient_gender?: string | null;
  patient_notes?: string | null;
  screening_status: string;
  screening_created_at: string;
  total_images: number;
  images: ScreeningImageResponse[];
  primary_prediction?: {
    id: string;
    predicted_class: string;
    confidence: number;
    inference_duration_ms?: number | null;
    probabilities: ProbabilityItem[];
  } | null;
  yolo_detections: DetectionItem[];
  xai_results: Array<{
    id: string;
    method: string;
    target_layer?: string | null;
    is_primary_user_facing: boolean;
    heatmap_storage_path: string;
    overlay_image_storage_path: string;
  }>;
  risk_assessment?: {
    id: string;
    risk_level: RiskLevel;
    risk_score: number;
    summary: string;
    recommended_action: string;
    contributing_factors: ContributingFactorItem[];
  } | null;
  dentist_assessments: DentistAssessmentSummary[];
  patient_lifestyle?: PatientLifestyleContext | null;
  linked_appointment?: AppointmentReviewContext | null;
}

export interface PatientLifestyleContext {
  smoking_status?: string | null;
  alcohol_consumption?: string | null;
  betel_quid_user?: boolean | null;
}

export interface AppointmentReviewContext {
  id: string;
  status: string;
  appointment_type: string;
  scheduled_start: string;
  scheduled_end: string;
  cancellation_reason?: string | null;
  consultation_id?: string | null;
}
