/**
 * OraVisionAI — useDentistAssessment Custom Reactive Hook (Phase 24)
 *
 * Coordinates clinical screening review package retrieval, assessment drafting,
 * and assessment finalization & locking with 409 Conflict handling.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getScreeningReview,
  createDentistAssessment,
  updateDentistAssessment,
  getDentistAssessment,
  generateScreeningReport,
  downloadReportPdfBlob,
} from '../api/dentistEndpoints';
import {
  DentistAssessment,
  DentistAssessmentCreate,
  DentistAssessmentUpdate,
} from '../types/dentist';
import { ScreeningReviewResponse, ReportResponse } from '../types/screening';
import { ApiError } from '../api/errors';

export function useDentistAssessment(screeningId: string) {
  const [reviewPackage, setReviewPackage] = useState<ScreeningReviewResponse | null>(null);
  const [loadingReview, setLoadingReview] = useState<boolean>(true);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [assessment, setAssessment] = useState<DentistAssessment | null>(null);
  const [savingDraft, setSavingDraft] = useState<boolean>(false);
  const [finalizing, setFinalizing] = useState<boolean>(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  const [generatingReport, setGeneratingReport] = useState<boolean>(false);
  const [reportData, setReportData] = useState<ReportResponse | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  // Load review package and existing assessment
  const loadReviewData = useCallback(async () => {
    if (!screeningId) return;
    setLoadingReview(true);
    setReviewError(null);
    try {
      const data = await getScreeningReview(screeningId);
      setReviewPackage(data);

      // Check for an existing assessment in the review package
      if (data.dentist_assessments && data.dentist_assessments.length > 0) {
        const existing = data.dentist_assessments[0];
        // Cast summary to full DentistAssessment representation
        setAssessment(existing as unknown as DentistAssessment);
      } else {
        // Fallback check against dedicated assessment endpoint
        try {
          const directAssessment = await getDentistAssessment(screeningId);
          setAssessment(directAssessment);
        } catch {
          // 404 is expected when no assessment has been drafted yet
          setAssessment(null);
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load screening review data';
      setReviewError(errorMsg);
    } finally {
      setLoadingReview(false);
    }
  }, [screeningId]);

  useEffect(() => {
    loadReviewData();
  }, [loadReviewData]);

  // Save assessment draft (is_finalized = false)
  const saveDraft = useCallback(
    async (formData: {
      clinical_observations: string;
      diagnosis_notes: string;
      treatment_recommendation: string;
      referral_needed: boolean;
      referral_specialty?: string | null;
    }): Promise<DentistAssessment> => {
      setSavingDraft(true);
      setAssessmentError(null);
      try {
        let result: DentistAssessment;
        if (assessment?.id) {
          const updatePayload: DentistAssessmentUpdate = {
            ...formData,
            is_finalized: false,
          };
          result = await updateDentistAssessment(screeningId, updatePayload);
        } else {
          const createPayload: DentistAssessmentCreate = {
            ...formData,
            is_finalized: false,
          };
          result = await createDentistAssessment(screeningId, createPayload);
        }
        setAssessment(result);
        return result;
      } catch (err: unknown) {
        if (err instanceof ApiError && err.statusCode === 409) {
          const conflictMsg =
            'This clinical assessment has been finalized and can no longer be edited through this system.';
          setAssessmentError(conflictMsg);
          throw new Error(conflictMsg);
        }
        const errorMsg = err instanceof Error ? err.message : 'Failed to save assessment draft';
        setAssessmentError(errorMsg);
        throw err;
      } finally {
        setSavingDraft(false);
      }
    },
    [screeningId, assessment],
  );

  // Finalize and lock assessment (is_finalized = true)
  const finalizeAssessment = useCallback(
    async (formData: {
      clinical_observations: string;
      diagnosis_notes: string;
      treatment_recommendation: string;
      referral_needed: boolean;
      referral_specialty?: string | null;
    }): Promise<DentistAssessment> => {
      setFinalizing(true);
      setAssessmentError(null);
      try {
        let result: DentistAssessment;
        if (assessment?.id) {
          const updatePayload: DentistAssessmentUpdate = {
            ...formData,
            is_finalized: true,
          };
          result = await updateDentistAssessment(screeningId, updatePayload);
        } else {
          const createPayload: DentistAssessmentCreate = {
            ...formData,
            is_finalized: true,
          };
          result = await createDentistAssessment(screeningId, createPayload);
        }
        setAssessment(result);
        return result;
      } catch (err: unknown) {
        if (err instanceof ApiError && err.statusCode === 409) {
          const conflictMsg =
            'This clinical assessment has been finalized and can no longer be edited through this system.';
          setAssessmentError(conflictMsg);
          throw new Error(conflictMsg);
        }
        const errorMsg = err instanceof Error ? err.message : 'Failed to finalize clinical assessment';
        setAssessmentError(errorMsg);
        throw err;
      } finally {
        setFinalizing(false);
      }
    },
    [screeningId, assessment],
  );

  // Generate / refresh clinical report
  const generateReport = useCallback(
    async (forceRegenerate: boolean = false, reportTitle?: string): Promise<ReportResponse> => {
      setGeneratingReport(true);
      setReportError(null);
      try {
        const report = await generateScreeningReport(screeningId, forceRegenerate, reportTitle);
        setReportData(report);
        return report;
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to generate clinical report';
        setReportError(errorMsg);
        throw err;
      } finally {
        setGeneratingReport(false);
      }
    },
    [screeningId],
  );

  // Download report PDF
  const downloadReport = useCallback(async (reportId: string, filename?: string): Promise<void> => {
    try {
      const blob = await downloadReportPdfBlob(reportId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `clinical_report_${reportId.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to download clinical report PDF';
      setReportError(errorMsg);
      throw err;
    }
  }, []);

  const isFinalized = Boolean(assessment?.is_finalized);

  return {
    reviewPackage,
    loadingReview,
    reviewError,
    reloadReview: loadReviewData,

    assessment,
    isFinalized,
    savingDraft,
    finalizing,
    assessmentError,
    saveDraft,
    finalizeAssessment,

    generatingReport,
    reportData,
    reportError,
    generateReport,
    downloadReport,
  };
}
