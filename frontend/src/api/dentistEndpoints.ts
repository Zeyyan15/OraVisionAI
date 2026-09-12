/**
 * OraVisionAI — Dentist Clinical Workspace & Assessment API Callers (Phase 24)
 *
 * Implements typed API callers matching the frozen backend endpoints:
 * - /api/dentists/me
 * - /api/dentists/me/verification
 * - /api/appointments
 * - /api/appointments/{id}
 * - /api/appointments/{id}/status
 * - /api/appointments/{id}/cancel
 * - /api/screenings/{id}/review
 * - /api/screenings/{id}/assessment
 * - /api/screenings/{id}/report
 * - /api/reports/{id}/download
 */

import { apiClient } from './client';
import { API_PATHS } from './endpoints';
import {
  DentistProfile,
  DentistProfileUpdate,
  DentistVerification,
  DentistVerificationCreate,
  Appointment,
  AppointmentListResponse,
  AppointmentStatusUpdate,
  AppointmentCancel,
  DentistAssessment,
  DentistAssessmentCreate,
  DentistAssessmentUpdate,
} from '../types/dentist';
import { ReportResponse, ScreeningReviewResponse } from '../types/screening';

// ============================================================================
// 1. Dentist Profile & Credential Verification
// ============================================================================

/**
 * Retrieves the authenticated dentist's professional profile.
 */
export async function getMyDentistProfile(): Promise<DentistProfile> {
  return apiClient.get<DentistProfile>(API_PATHS.DENTIST_ME);
}

/**
 * Updates the authenticated dentist's professional profile metadata.
 */
export async function updateMyDentistProfile(
  data: DentistProfileUpdate,
): Promise<DentistProfile> {
  return apiClient.patch<DentistProfile>(API_PATHS.DENTIST_ME, data);
}

/**
 * Retrieves the latest verification document status for the authenticated dentist.
 */
export async function getMyVerificationStatus(): Promise<DentistVerification> {
  return apiClient.get<DentistVerification>(API_PATHS.DENTIST_VERIFICATION);
}

/**
 * Submits professional credential document metadata for administrator review.
 */
export async function submitMyVerification(
  data: DentistVerificationCreate,
): Promise<DentistVerification> {
  return apiClient.post<DentistVerification>(API_PATHS.DENTIST_VERIFICATION, data);
}

// ============================================================================
// 2. Clinical Appointments Queue Management
// ============================================================================

/**
 * Lists appointments for the authenticated user, optionally filtered by status.
 * For dentists, returns appointments scheduled with them.
 */
export async function listAppointments(
  statusFilter?: string,
): Promise<AppointmentListResponse> {
  return apiClient.get<AppointmentListResponse>(API_PATHS.APPOINTMENTS, {
    params: statusFilter ? { status: statusFilter } : undefined,
  });
}

/**
 * Retrieves specific appointment details by UUID.
 */
export async function getAppointment(appointmentId: string): Promise<Appointment> {
  return apiClient.get<Appointment>(API_PATHS.APPOINTMENT_DETAIL(appointmentId));
}

/**
 * Updates an appointment's lifecycle status (confirmed, in_progress, completed, etc.).
 */
export async function updateAppointmentStatus(
  appointmentId: string,
  data: AppointmentStatusUpdate,
): Promise<Appointment> {
  return apiClient.patch<Appointment>(API_PATHS.APPOINTMENT_STATUS(appointmentId), data);
}

/**
 * Cancels a scheduled appointment with mandatory cancellation reason.
 */
export async function cancelAppointment(
  appointmentId: string,
  data: AppointmentCancel,
): Promise<Appointment> {
  return apiClient.patch<Appointment>(API_PATHS.APPOINTMENT_CANCEL(appointmentId), data);
}

// ============================================================================
// 3. Clinical Assessment & Screening Evaluation
// ============================================================================

/**
 * Retrieves the comprehensive multi-modal clinical review package for a screening session.
 */
export async function getScreeningReview(screeningId: string): Promise<ScreeningReviewResponse> {
  return apiClient.get<ScreeningReviewResponse>(API_PATHS.SCREENING_REVIEW(screeningId));
}

/**
 * Creates a licensed dentist clinical assessment for an oral screening session.
 */
export async function createDentistAssessment(
  screeningId: string,
  data: DentistAssessmentCreate,
): Promise<DentistAssessment> {
  return apiClient.post<DentistAssessment>(API_PATHS.SCREENING_ASSESSMENT(screeningId), data);
}

/**
 * Retrieves the recorded dentist clinical assessment for an oral screening session.
 */
export async function getDentistAssessment(screeningId: string): Promise<DentistAssessment> {
  return apiClient.get<DentistAssessment>(API_PATHS.SCREENING_ASSESSMENT(screeningId));
}

/**
 * Updates an unfinalized clinical assessment draft, or finalizes and locks it.
 */
export async function updateDentistAssessment(
  screeningId: string,
  data: DentistAssessmentUpdate,
): Promise<DentistAssessment> {
  return apiClient.patch<DentistAssessment>(API_PATHS.SCREENING_ASSESSMENT(screeningId), data);
}

/**
 * Generates or refreshes a frozen clinical snapshot report and ReportLab PDF.
 */
export async function generateScreeningReport(
  screeningId: string,
  forceRegenerate: boolean = false,
  reportTitle: string = 'Oral Health AI Screening Report',
): Promise<ReportResponse> {
  return apiClient.post<ReportResponse>(
    API_PATHS.SCREENING_REPORT(screeningId),
    { force_regenerate: forceRegenerate, report_title: reportTitle },
  );
}

/**
 * Downloads the clinical report PDF via authenticated streaming.
 */
export async function downloadReportPdfBlob(reportId: string): Promise<Blob> {
  return apiClient.downloadBlob(API_PATHS.REPORT_DOWNLOAD(reportId));
}
