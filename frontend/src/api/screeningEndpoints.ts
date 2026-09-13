/**
 * OraVisionAI — Screening API Callers (Phase 23)
 *
 * Direct integration with backend screening endpoints.
 */

import { apiClient } from './client';
import { API_PATHS } from './endpoints';
import {
  ScreeningCreate,
  ScreeningResponse,
  ScreeningDetailResponse,
  ScreeningListResponse,
  ScreeningDeleteResponse,
  ScreeningImageResponse,
  ScreeningInferenceResponse,
  ScreeningXAIResponse,
  RiskAssessmentResponse,
  ReportResponse,
  ScreeningReviewResponse,
} from '../types/screening';

/**
 * Initiates a new patient screening session.
 */
export async function createScreening(data?: ScreeningCreate): Promise<ScreeningResponse> {
  return apiClient.post<ScreeningResponse>(API_PATHS.SCREENINGS, data || {});
}

/**
 * Uploads an oral cavity photograph to an existing screening session.
 */
export async function uploadScreeningImage(
  screeningId: string,
  file: File,
  isPrimary: boolean = true,
): Promise<ScreeningImageResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('is_primary', String(isPrimary));
  return apiClient.post<ScreeningImageResponse>(API_PATHS.SCREENING_IMAGES(screeningId), formData);
}

/**
 * Executes dual-stage AI inference (YOLO lesion detector + EfficientNetB0 classification).
 */
export async function runScreeningAI(
  screeningId: string,
  forceRecompute: boolean = false,
): Promise<ScreeningInferenceResponse> {
  return apiClient.post<ScreeningInferenceResponse>(
    API_PATHS.SCREENING_RUN_AI(screeningId),
    undefined,
    { params: { force_recompute: forceRecompute } },
  );
}

/**
 * Retrieves screening session details and image list.
 */
export async function getScreeningDetail(screeningId: string): Promise<ScreeningDetailResponse> {
  return apiClient.get<ScreeningDetailResponse>(API_PATHS.SCREENING_DETAIL(screeningId));
}

/**
 * Retrieves the comprehensive multi-modal clinical review package.
 */
export async function getScreeningReview(screeningId: string): Promise<ScreeningReviewResponse> {
  return apiClient.get<ScreeningReviewResponse>(API_PATHS.SCREENING_REVIEW(screeningId));
}

/**
 * Retrieves a paginated list of screenings for the authenticated patient.
 */
export async function listPatientScreenings(
  page: number = 1,
  pageSize: number = 20,
): Promise<ScreeningListResponse> {
  return apiClient.get<ScreeningListResponse>(API_PATHS.SCREENINGS, {
    params: { page, page_size: pageSize },
  });
}

/**
 * Soft-deletes a screening session.
 */
export async function deleteScreening(screeningId: string): Promise<ScreeningDeleteResponse> {
  return apiClient.delete<ScreeningDeleteResponse>(API_PATHS.SCREENING_DETAIL(screeningId));
}

/**
 * Retrieves existing XAI explainability heatmaps for a screening session.
 */
export async function getScreeningXAI(screeningId: string): Promise<ScreeningXAIResponse> {
  return apiClient.get<ScreeningXAIResponse>(API_PATHS.SCREENING_XAI(screeningId));
}

/**
 * Generates an on-demand XAI visual explanation using a specific method.
 * Target layer: block6a_expand_conv.
 */
export async function generateScreeningXAIMethod(
  screeningId: string,
  method: string,
  forceRecompute: boolean = false,
): Promise<ScreeningXAIResponse> {
  return apiClient.post<ScreeningXAIResponse>(
    API_PATHS.SCREENING_XAI_METHOD(screeningId, method),
    undefined,
    { params: { force_recompute: forceRecompute } },
  );
}

/**
 * Retrieves existing deterministic clinical risk assessment.
 */
export async function getScreeningRiskAssessment(
  screeningId: string,
): Promise<RiskAssessmentResponse> {
  return apiClient.get<RiskAssessmentResponse>(API_PATHS.SCREENING_RISK(screeningId));
}

/**
 * Generates or recomputes screening clinical risk assessment.
 */
export async function generateScreeningRiskAssessment(
  screeningId: string,
  forceRecompute: boolean = false,
): Promise<RiskAssessmentResponse> {
  return apiClient.post<RiskAssessmentResponse>(
    API_PATHS.SCREENING_RISK(screeningId),
    { force_recompute: forceRecompute },
  );
}

/**
 * Retrieves existing clinical report for a screening session.
 */
export async function getScreeningReport(screeningId: string): Promise<ReportResponse> {
  return apiClient.get<ReportResponse>(API_PATHS.SCREENING_REPORT(screeningId));
}

/**
 * Generates or retrieves a frozen clinical snapshot report and ReportLab PDF.
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
 * Downloads clinical report PDF via authenticated streaming.
 */
export async function downloadReportPdfBlob(reportId: string): Promise<Blob> {
  return apiClient.downloadBlob(API_PATHS.REPORT_DOWNLOAD(reportId));
}

/**
 * Retrieves a short-lived signed URL for an authorized screening artifact
 * (screening image, XAI heatmap/overlay, or report PDF).
 */
export async function getArtifactSignedUrl(
  screeningId: string,
  storagePath: string,
): Promise<{ signed_url: string; storage_path: string; expires_in: number }> {
  const res = await apiClient.get<{ signed_url: string; storage_path: string; expires_in: number }>(
    API_PATHS.SCREENING_ARTIFACT_URL(screeningId),
    { params: { path: storagePath } },
  );
  if (res.signed_url && res.signed_url.includes('/object/sign/') && !res.signed_url.includes('/storage/v1/object/sign/')) {
    res.signed_url = res.signed_url.replace('/object/sign/', '/storage/v1/object/sign/');
  }
  return res;
}

