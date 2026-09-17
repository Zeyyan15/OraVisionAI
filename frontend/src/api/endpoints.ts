/**
 * OraVisionAI — Foundational API Endpoints Catalog
 *
 * Provides:
 * 1. Canonical API path constants matching backend routes
 * 2. Lightweight foundational callers needed for session bootstrapping and RBAC
 * 3. Screening and diagnostic API paths (Phase 23)
 */

import { apiClient } from './client';
import { AuthIdentityResponse, RoleAccessResponse, UserResponse } from '../types/api';

export const API_PATHS = {
  // Authentication & Identity
  AUTH_ME: '/api/auth/me',
  USERS_ME: '/api/users/me',
  USERS_SYNC: '/api/users/sync',
  PATIENT_ACCESS: '/api/users/me/patient-access',
  DENTIST_ACCESS: '/api/users/me/dentist-access',
  ADMIN_ACCESS: '/api/users/me/admin-access',

  // Screening & Diagnostic Endpoints (Phase 23)
  SCREENINGS: '/api/screenings',
  SCREENING_DETAIL: (screeningId: string) => `/api/screenings/${screeningId}`,
  SCREENING_IMAGES: (screeningId: string) => `/api/screenings/${screeningId}/images`,
  SCREENING_RUN_AI: (screeningId: string) => `/api/screenings/${screeningId}/run-ai`,
  SCREENING_REVIEW: (screeningId: string) => `/api/screenings/${screeningId}/review`,
  SCREENING_XAI: (screeningId: string) => `/api/screenings/${screeningId}/xai`,
  SCREENING_XAI_METHOD: (screeningId: string, method: string) => `/api/screenings/${screeningId}/xai/${method}`,
  SCREENING_RISK: (screeningId: string) => `/api/screenings/${screeningId}/risk-assessment`,
  SCREENING_REPORT: (screeningId: string) => `/api/screenings/${screeningId}/report`,
  SCREENING_ARTIFACT_URL: (screeningId: string) => `/api/screenings/${screeningId}/artifacts/signed-url`,

  // Report Download (authenticated binary streaming)
  REPORT_DOWNLOAD: (reportId: string) => `/api/reports/${reportId}/download`,

  // Dentist Clinical Workspace & Appointments (Phase 24)
  DENTISTS: '/api/dentists',
  DENTIST_PUBLIC_AVAILABILITY: (dentistId: string) => `/api/dentists/${dentistId}/availability`,
  DENTIST_BOOK_APPOINTMENT: (dentistId: string) => `/api/dentists/${dentistId}/appointments`,
  DENTIST_ME: '/api/dentists/me',
  DENTIST_VERIFICATION: '/api/dentists/me/verification',
  APPOINTMENTS: '/api/appointments',
  APPOINTMENT_DETAIL: (appointmentId: string) => `/api/appointments/${appointmentId}`,
  APPOINTMENT_STATUS: (appointmentId: string) => `/api/appointments/${appointmentId}/status`,
  APPOINTMENT_CONFIRM: (appointmentId: string) => `/api/appointments/${appointmentId}/confirm`,
  APPOINTMENT_REJECT: (appointmentId: string) => `/api/appointments/${appointmentId}/reject`,
  APPOINTMENT_CANCEL: (appointmentId: string) => `/api/appointments/${appointmentId}/cancel`,
  SCREENING_ASSESSMENT: (screeningId: string) => `/api/screenings/${screeningId}/assessment`,
  SCREENING_REQUEST_REVIEW: (screeningId: string) => `/api/screenings/${screeningId}/request-review`,
  DENTIST_PENDING_REVIEWS: '/api/dentists/me/reviews',
  DENTIST_PATIENT_CASES: '/api/dentists/me/patient-cases',
  MY_PRACTITIONERS: '/api/dentists/my-practitioners',

  // Teleconsultation & Session Management (Phase 25)
  APPOINTMENT_CONSULTATION: (appointmentId: string) => `/api/appointments/${appointmentId}/consultation`,
  CONSULTATIONS: '/api/consultations',
  CONSULTATION_DETAIL: (consultationId: string) => `/api/consultations/${consultationId}`,
  CONSULTATION_START: (consultationId: string) => `/api/consultations/${consultationId}/start`,
  CONSULTATION_END: (consultationId: string) => `/api/consultations/${consultationId}/end`,
  CONSULTATION_FAIL: (consultationId: string) => `/api/consultations/${consultationId}/fail`,
  // Platform Administration & Oversight (Phase 26)
  ADMIN_AUDIT_LOGS: '/api/admin/audit-logs',
  ADMIN_AUDIT_LOG_DETAIL: (auditLogId: string) => `/api/admin/audit-logs/${auditLogId}`,
  ADMIN_ANALYTICS_OVERVIEW: '/api/admin/analytics/overview',
  ADMIN_ANALYTICS_SCREENINGS: '/api/admin/analytics/screenings',
  ADMIN_ANALYTICS_AI_TELEMETRY: '/api/admin/analytics/ai-telemetry',
  ADMIN_ANALYTICS_TELEHEALTH: '/api/admin/analytics/telehealth',
  ADMIN_AI_MODELS: '/api/admin/ai-models',
  ADMIN_AI_MODEL_DETAIL: (modelId: string) => `/api/admin/ai-models/${modelId}`,
  ADMIN_DENTIST_VERIFICATIONS: '/api/admin/dentist-verifications',
  ADMIN_DENTIST_VERIFICATION_DETAIL: (verificationId: string) =>
    `/api/admin/dentist-verifications/${verificationId}`,
  ADMIN_DENTIST_VERIFICATION_APPROVE: (verificationId: string) =>
    `/api/admin/dentist-verifications/${verificationId}/approve`,
  ADMIN_DENTIST_VERIFICATION_REJECT: (verificationId: string) =>
    `/api/admin/dentist-verifications/${verificationId}/reject`,

  // Conversations & Direct Messaging (Phase 16 & 27)
  DENTIST_CONVERSATIONS: (dentistId: string) => `/api/dentists/${dentistId}/conversations`,
  PATIENT_CONVERSATIONS: (patientId: string) => `/api/patients/${patientId}/conversations`,
  CONVERSATIONS: '/api/conversations',
  CONVERSATION_DETAIL: (conversationId: string) => `/api/conversations/${conversationId}`,
  CONVERSATION_ARCHIVE: (conversationId: string) => `/api/conversations/${conversationId}/archive`,
  CONVERSATION_MESSAGES: (conversationId: string) => `/api/conversations/${conversationId}/messages`,
  CONVERSATION_MESSAGE_DETAIL: (conversationId: string, messageId: string) =>
    `/api/conversations/${conversationId}/messages/${messageId}`,
  CONVERSATION_READ: (conversationId: string) => `/api/conversations/${conversationId}/read`,

  // In-App Notifications (Phase 17 & 27)
  NOTIFICATIONS: '/api/notifications',
  NOTIFICATIONS_UNREAD_COUNT: '/api/notifications/unread-count',
  NOTIFICATION_DETAIL: (notificationId: string) => `/api/notifications/${notificationId}`,
  NOTIFICATION_READ: (notificationId: string) => `/api/notifications/${notificationId}/read`,
  NOTIFICATIONS_READ_ALL: '/api/notifications/read-all',
} as const;

export const ENDPOINTS = API_PATHS;

/**
 * Verifies current Firebase token identity via FastAPI backend
 */
export async function getAuthIdentity(): Promise<AuthIdentityResponse> {
  return apiClient.get<AuthIdentityResponse>(API_PATHS.AUTH_ME);
}

/**
 * Resolves PostgreSQL application User profile and authoritative role
 */
export async function getCurrentUserProfile(): Promise<UserResponse> {
  return apiClient.get<UserResponse>(API_PATHS.USERS_ME);
}

/**
 * Synchronizes initial onboarding profile and requested role with backend
 */
export async function syncUserProfile(payload: {
  role?: 'patient' | 'dentist';
  first_name?: string;
  last_name?: string;
  phone_number?: string;
}): Promise<UserResponse> {
  return apiClient.post<UserResponse>(API_PATHS.USERS_SYNC, payload);
}

/**
 * Verifies patient RBAC authorization
 */
export async function verifyPatientRole(): Promise<RoleAccessResponse> {
  return apiClient.get<RoleAccessResponse>(API_PATHS.PATIENT_ACCESS);
}

/**
 * Verifies dentist RBAC authorization
 */
export async function verifyDentistRole(): Promise<RoleAccessResponse> {
  return apiClient.get<RoleAccessResponse>(API_PATHS.DENTIST_ACCESS);
}

/**
 * Verifies admin RBAC authorization
 */
export async function verifyAdminRole(): Promise<RoleAccessResponse> {
  return apiClient.get<RoleAccessResponse>(API_PATHS.ADMIN_ACCESS);
}
