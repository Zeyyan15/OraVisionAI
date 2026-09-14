/**
 * OraVisionAI — Administrative & Oversight API Callers (Phase 26)
 *
 * Implements typed callers for the 8 frozen Phase 18 backend operations:
 * 1. GET /api/admin/audit-logs
 * 2. GET /api/admin/audit-logs/{audit_log_id}
 * 3. GET /api/admin/analytics/overview
 * 4. GET /api/admin/analytics/screenings
 * 5. GET /api/admin/analytics/ai-telemetry
 * 6. GET /api/admin/analytics/telehealth
 * 7. GET /api/admin/ai-models
 * 8. GET /api/admin/ai-models/{model_id}
 */

import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';
import {
  AdminAuditLogListResponse,
  AdminAuditLogResponse,
  AuditLogQueryParams,
  PlatformOverviewAnalyticsResponse,
  ClinicalScreeningAnalyticsResponse,
  ScreeningAnalyticsQueryParams,
  AITelemetryAnalyticsResponse,
  TelehealthAnalyticsResponse,
  AIModelListResponse,
  AIModelResponse,
  AdminDentistVerificationResponse,
  AdminVerificationListResponse,
  VerificationReviewRequest,
  DentistVerificationQueryParams,
} from '../types/admin';

/**
 * 1. Paginated, filtered inspection of immutable security & compliance audit logs
 */
export async function listAuditLogs(
  params?: AuditLogQueryParams
): Promise<AdminAuditLogListResponse> {
  const queryParams: Record<string, string | number | boolean | undefined> = {};
  if (params?.page !== undefined) queryParams.page = params.page;
  if (params?.page_size !== undefined) queryParams.page_size = params.page_size;
  if (params?.user_id) queryParams.user_id = params.user_id;
  if (params?.action) queryParams.action = params.action;
  if (params?.resource_type) queryParams.resource_type = params.resource_type;
  if (params?.start_date) queryParams.start_date = params.start_date;
  if (params?.end_date) queryParams.end_date = params.end_date;

  return apiClient.get<AdminAuditLogListResponse>(ENDPOINTS.ADMIN_AUDIT_LOGS, {
    params: queryParams,
  });
}

/**
 * 2. Detail retrieval for a specific audit log entry (privacy-redacted)
 */
export async function getAuditLogDetail(
  auditLogId: string
): Promise<AdminAuditLogResponse> {
  return apiClient.get<AdminAuditLogResponse>(
    ENDPOINTS.ADMIN_AUDIT_LOG_DETAIL(auditLogId)
  );
}

/**
 * 3. Retrieve platform-wide operational KPIs and aggregate telemetry
 */
export async function getPlatformOverview(): Promise<PlatformOverviewAnalyticsResponse> {
  return apiClient.get<PlatformOverviewAnalyticsResponse>(
    ENDPOINTS.ADMIN_ANALYTICS_OVERVIEW
  );
}

/**
 * 4. Retrieve screening cohort analytics strictly anchored to Screening.created_at
 */
export async function getScreeningAnalytics(
  params?: ScreeningAnalyticsQueryParams
): Promise<ClinicalScreeningAnalyticsResponse> {
  const queryParams: Record<string, string | number | boolean | undefined> = {};
  if (params?.start_date) queryParams.start_date = params.start_date;
  if (params?.end_date) queryParams.end_date = params.end_date;

  return apiClient.get<ClinicalScreeningAnalyticsResponse>(
    ENDPOINTS.ADMIN_ANALYTICS_SCREENINGS,
    { params: queryParams }
  );
}

/**
 * 5. Retrieve operational AI inference telemetry, 7-class distribution, and YOLO/XAI counts
 */
export async function getAITelemetry(): Promise<AITelemetryAnalyticsResponse> {
  return apiClient.get<AITelemetryAnalyticsResponse>(
    ENDPOINTS.ADMIN_ANALYTICS_AI_TELEMETRY
  );
}

/**
 * 6. Retrieve appointment scheduling and live teleconsultation utilization metrics
 */
export async function getTelehealthAnalytics(): Promise<TelehealthAnalyticsResponse> {
  return apiClient.get<TelehealthAnalyticsResponse>(
    ENDPOINTS.ADMIN_ANALYTICS_TELEHEALTH
  );
}

/**
 * 7. Read-only listing of registered versioned AIModel entities
 */
export async function listAIModels(): Promise<AIModelListResponse> {
  return apiClient.get<AIModelListResponse>(ENDPOINTS.ADMIN_AI_MODELS);
}

/**
 * 8. Inspect architectural metadata of an individual AIModel (omits server weights_path)
 */
export async function getAIModelDetail(modelId: string): Promise<AIModelResponse> {
  return apiClient.get<AIModelResponse>(
    ENDPOINTS.ADMIN_AI_MODEL_DETAIL(modelId)
  );
}

/**
 * 9. List dentist verification submissions with optional status filter and pagination
 */
export async function listDentistVerifications(
  params?: DentistVerificationQueryParams
): Promise<AdminVerificationListResponse> {
  const queryParams: Record<string, string | number | boolean | undefined> = {};
  if (params?.status && params.status !== 'all') queryParams.status = params.status;
  if (params?.page !== undefined) queryParams.page = params.page;
  if (params?.page_size !== undefined) queryParams.page_size = params.page_size;

  return apiClient.get<AdminVerificationListResponse>(ENDPOINTS.ADMIN_DENTIST_VERIFICATIONS, {
    params: queryParams,
  });
}

/**
 * 10. Retrieve individual dentist verification submission detail
 */
export async function getDentistVerificationDetail(
  verificationId: string
): Promise<AdminDentistVerificationResponse> {
  return apiClient.get<AdminDentistVerificationResponse>(
    ENDPOINTS.ADMIN_DENTIST_VERIFICATION_DETAIL(verificationId)
  );
}

/**
 * 11. Approve dentist verification submission
 */
export async function approveDentistVerification(
  verificationId: string,
  data?: VerificationReviewRequest
): Promise<AdminDentistVerificationResponse> {
  return apiClient.post<AdminDentistVerificationResponse>(
    ENDPOINTS.ADMIN_DENTIST_VERIFICATION_APPROVE(verificationId),
    data || {}
  );
}

/**
 * 12. Reject dentist verification submission
 */
export async function rejectDentistVerification(
  verificationId: string,
  data?: VerificationReviewRequest
): Promise<AdminDentistVerificationResponse> {
  return apiClient.post<AdminDentistVerificationResponse>(
    ENDPOINTS.ADMIN_DENTIST_VERIFICATION_REJECT(verificationId),
    data || {}
  );
}
