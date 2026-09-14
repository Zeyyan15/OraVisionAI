/**
 * OraVisionAI — Admin & Platform Oversight Domain Types (Phase 26)
 *
 * Derived strictly from the frozen Phase 18 backend schemas:
 * - app/schemas/analytics.py
 * - app/schemas/admin.py
 */

import { UserRole } from './domain';

// ============================================================================
// 1. Audit Log Schemas & Filters
// ============================================================================

export interface AdminAuditLogResponse {
  id: string;
  user_id?: string | null;
  actor_email?: string | null;
  actor_role?: UserRole | string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  details?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  timestamp: string;
}

export interface AdminAuditLogListResponse {
  items: AdminAuditLogResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AuditLogQueryParams {
  user_id?: string;
  action?: string;
  resource_type?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

// Authoritative repository-derived resource types
export const AUDIT_RESOURCE_TYPES = [
  'ai_model',
  'analytics',
  'appointment',
  'audit_log',
  'consultation',
  'conversation',
  'dentist_assessment',
  'dentist_availability',
  'dentist_verification',
  'message',
  'notification',
  'report',
  'risk_assessment',
  'screening',
  'user',
] as const;

export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[number];

// Authoritative repository-derived audit actions
export const AUDIT_ACTIONS = [
  'AI_ANALYTICS_VIEWED',
  'AI_MODELS_CATALOG_VIEWED',
  'APPOINTMENT_CANCELLED',
  'APPOINTMENT_CREATED',
  'APPOINTMENT_STATUS_UPDATED',
  'APPOINTMENT_VIEWED',
  'AUDIT_LOGS_VIEWED',
  'AUDIT_LOG_DETAIL_VIEWED',
  'CLINICAL_ANALYTICS_VIEWED',
  'CONSULTATION_COMPLETED',
  'CONSULTATION_CREATED',
  'CONSULTATION_FAILED',
  'CONSULTATION_STARTED',
  'CONSULTATION_VIEWED',
  'CONVERSATION_ARCHIVED',
  'CONVERSATION_CREATED',
  'CONVERSATION_VIEWED',
  'DENTIST_ASSESSMENT_CREATED',
  'DENTIST_ASSESSMENT_UPDATED',
  'DENTIST_ASSESSMENT_VIEWED',
  'DENTIST_AVAILABILITY_CREATED',
  'DENTIST_AVAILABILITY_DELETED',
  'DENTIST_AVAILABILITY_UPDATED',
  'DENTIST_AVAILABILITY_VIEWED',
  'DENTIST_VERIFICATION_APPROVED',
  'DENTIST_VERIFICATION_REJECTED',
  'MESSAGES_READ',
  'MESSAGES_VIEWED',
  'MESSAGE_SENT',
  'NOTIFICATIONS_READ_ALL',
  'NOTIFICATION_READ',
  'NOTIFICATION_VIEWED',
  'PLATFORM_ANALYTICS_VIEWED',
  'REPORT_DOWNLOADED',
  'REPORT_GENERATED',
  'REPORT_VIEWED',
  'RISK_ASSESSMENT_GENERATED',
  'RISK_ASSESSMENT_VIEWED',
  'TELEHEALTH_ANALYTICS_VIEWED',
  'USER_STATUS_UPDATE',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// ============================================================================
// 2. Platform Overview Analytics Schemas
// ============================================================================

export interface UserOverviewMetrics {
  total_users: number;
  active_users: number;
  inactive_users: number;
  patient_count: number;
  dentist_count: number;
  admin_count: number;
}

export interface DentistVerificationOverviewMetrics {
  total_verifications: number;
  pending_verifications: number;
  approved_verifications: number;
  rejected_verifications: number;
}

export interface ScreeningOverviewMetrics {
  total_screenings: number;
  pending_screenings: number;
  processing_screenings: number;
  completed_screenings: number;
  failed_screenings: number;
}

export interface TelehealthOverviewMetrics {
  total_appointments: number;
  completed_appointments: number;
  total_consultations: number;
  ended_consultations: number;
}

export interface CommunicationOverviewMetrics {
  total_conversations: number;
  total_messages: number;
}

export interface PlatformOverviewAnalyticsResponse {
  users: UserOverviewMetrics;
  dentist_verifications: DentistVerificationOverviewMetrics;
  screenings: ScreeningOverviewMetrics;
  telehealth: TelehealthOverviewMetrics;
  communication: CommunicationOverviewMetrics;
  total_audit_logs: number;
  generated_at: string;
}

// ============================================================================
// 3. Clinical Screening Workflow Analytics Schemas
// ============================================================================

export interface RiskDistributionItem {
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
  count: number;
  percentage: number;
}

export interface DentistAssessmentMetrics {
  total_assessments: number;
  finalized_count: number;
  draft_count: number;
}

export interface ClinicalScreeningAnalyticsResponse {
  total_screenings: number;
  screening_status_breakdown: Record<string, number>;
  risk_distribution: RiskDistributionItem[];
  dentist_assessments: DentistAssessmentMetrics;
  reports_generated: number;
  start_date?: string | null;
  end_date?: string | null;
  generated_at: string;
}

export interface ScreeningAnalyticsQueryParams {
  start_date?: string;
  end_date?: string;
}

// ============================================================================
// 4. AI Telemetry Analytics Schemas
// ============================================================================

export interface AIClassTelemetryItem {
  class_code: 'CaS' | 'CoS' | 'Gum' | 'MC' | 'OC' | 'OLP' | 'OT' | string;
  class_name: string;
  count: number;
  percentage: number;
}

export interface AIActiveModelSummary {
  name: string;
  version: string;
  model_type: string;
  architecture: string;
  input_shape: string;
}

export interface AITelemetryAnalyticsResponse {
  total_predictions: number;
  classification_distribution: AIClassTelemetryItem[];
  average_prediction_confidence: number;
  total_yolo_detections: number;
  average_detections_per_image: number;
  total_xai_generations: number;
  active_models: AIActiveModelSummary[];
  generated_at: string;
}

// ============================================================================
// 5. Telehealth Utilization Analytics Schemas
// ============================================================================

export interface TelehealthAnalyticsResponse {
  total_appointments: number;
  appointment_status_breakdown: Record<string, number>;
  appointment_cancellation_rate: number;
  total_consultations: number;
  consultation_status_breakdown: Record<string, number>;
  total_ended_consultation_duration_seconds: number;
  average_ended_consultation_duration_seconds: number;
  generated_at: string;
}

// ============================================================================
// 6. AI Model Registry Schemas
// ============================================================================

export interface AIModelResponse {
  id: string;
  name: string;
  model_type: 'classifier' | 'detector' | 'multimodal' | 'risk_engine' | string;
  version: string;
  architecture: string;
  input_shape: string;
  class_labels: unknown[];
  target_layers?: unknown[] | null;
  is_active: boolean;
  created_at: string;
}

export interface AIModelListResponse {
  items: AIModelResponse[];
  total: number;
}

// ============================================================================
// 7. Admin Dentist Verification Review Schemas
// ============================================================================

export interface AdminDentistVerificationResponse {
  id: string;
  dentist_id: string;
  dentist_user_id?: string | null;
  dentist_name?: string | null;
  dentist_email?: string | null;
  license_number?: string | null;
  specialization?: string | null;
  document_type: string;
  document_url: string;
  file_name: string;
  file_size_bytes?: number | null;
  status: 'pending' | 'approved' | 'rejected' | string;
  reviewer_id?: string | null;
  review_notes?: string | null;
  submitted_at: string;
  reviewed_at?: string | null;
}

export interface AdminVerificationListResponse {
  items: AdminDentistVerificationResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface VerificationReviewRequest {
  review_notes?: string | null;
}

export interface DentistVerificationQueryParams {
  status?: string;
  page?: number;
  page_size?: number;
}
