/**
 * OraVisionAI — useScreening Hook (Phase 23)
 *
 * Encapsulates screening state machine: creation, image upload, AI inference,
 * XAI execution, risk context retrieval, report generation, and PDF download.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ApiError } from '../api/errors';
import * as api from '../api/screeningEndpoints';
import {
  ScreeningReviewResponse,
  ScreeningResponse,
  ScreeningImageResponse,
  ScreeningInferenceResponse,
  ScreeningXAIResponse,
  RiskAssessmentResponse,
  ReportResponse,
  ScreeningCreate,
} from '../types/screening';

export interface UseScreeningState {
  screening: ScreeningReviewResponse | null;
  loading: boolean;
  error: ApiError | null;
  isCreating: boolean;
  isUploading: boolean;
  isInferencing: boolean;
  isGeneratingXai: boolean;
  isGeneratingReport: boolean;
  isDownloadingReport: boolean;
}

export function useScreening(initialScreeningId?: string) {
  const [screening, setScreening] = useState<ScreeningReviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(initialScreeningId));
  const [error, setError] = useState<ApiError | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isInferencing, setIsInferencing] = useState(false);
  const [isGeneratingXai, setIsGeneratingXai] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);

  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Fetches full multi-modal screening package.
   */
  const fetchScreening = useCallback(async (screeningId: string): Promise<ScreeningReviewResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getScreeningReview(screeningId);
      if (isMountedRef.current) {
        setScreening(data);
        setLoading(false);
      }
      return data;
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setError(err instanceof ApiError ? err : new ApiError(0, (err as Error).message));
        setLoading(false);
      }
      return null;
    }
  }, []);

  useEffect(() => {
    if (initialScreeningId) {
      fetchScreening(initialScreeningId);
    }
  }, [initialScreeningId, fetchScreening]);

  /**
   * Initiates a new screening session.
   */
  const createSession = useCallback(async (data?: ScreeningCreate): Promise<ScreeningResponse | null> => {
    setIsCreating(true);
    setError(null);
    try {
      const res = await api.createScreening(data);
      if (isMountedRef.current) {
        setIsCreating(false);
      }
      return res;
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setError(err instanceof ApiError ? err : new ApiError(0, (err as Error).message));
        setIsCreating(false);
      }
      return null;
    }
  }, []);

  /**
   * Uploads an oral photograph to the session.
   */
  const uploadImage = useCallback(async (screeningId: string, file: File): Promise<ScreeningImageResponse | null> => {
    setIsUploading(true);
    setError(null);
    try {
      const res = await api.uploadScreeningImage(screeningId, file, true);
      if (isMountedRef.current) {
        setIsUploading(false);
      }
      return res;
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setError(err instanceof ApiError ? err : new ApiError(0, (err as Error).message));
        setIsUploading(false);
      }
      return null;
    }
  }, []);

  /**
   * Executes dual-stage AI inference synchronously.
   */
  const runInference = useCallback(async (screeningId: string): Promise<ScreeningInferenceResponse | null> => {
    setIsInferencing(true);
    setError(null);
    try {
      const res = await api.runScreeningAI(screeningId);
      if (isMountedRef.current) {
        setIsInferencing(false);
      }
      return res;
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setError(err instanceof ApiError ? err : new ApiError(0, (err as Error).message));
        setIsInferencing(false);
      }
      return null;
    }
  }, []);

  /**
   * Generates a specific XAI visual explanation.
   */
  const generateXai = useCallback(async (screeningId: string, method: string): Promise<ScreeningXAIResponse | null> => {
    setIsGeneratingXai(true);
    setError(null);
    try {
      const res = await api.generateScreeningXAIMethod(screeningId, method);
      if (isMountedRef.current) {
        setIsGeneratingXai(false);
      }
      await fetchScreening(screeningId);
      return res;
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setError(err instanceof ApiError ? err : new ApiError(0, (err as Error).message));
        setIsGeneratingXai(false);
      }
      return null;
    }
  }, [fetchScreening]);

  /**
   * Generates or re-evaluates clinical risk assessment.
   */
  const computeRisk = useCallback(async (screeningId: string): Promise<RiskAssessmentResponse | null> => {
    try {
      const res = await api.generateScreeningRiskAssessment(screeningId);
      await fetchScreening(screeningId);
      return res;
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setError(err instanceof ApiError ? err : new ApiError(0, (err as Error).message));
      }
      return null;
    }
  }, [fetchScreening]);

  /**
   * Generates or retrieves clinical report.
   */
  const generateReport = useCallback(async (screeningId: string): Promise<ReportResponse | null> => {
    setIsGeneratingReport(true);
    setError(null);
    try {
      const res = await api.generateScreeningReport(screeningId);
      if (isMountedRef.current) {
        setIsGeneratingReport(false);
      }
      return res;
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setError(err instanceof ApiError ? err : new ApiError(0, (err as Error).message));
        setIsGeneratingReport(false);
      }
      return null;
    }
  }, []);

  /**
   * Downloads clinical report PDF via authenticated binary stream.
   */
  const downloadPdf = useCallback(async (reportId: string, filename: string): Promise<boolean> => {
    setIsDownloadingReport(true);
    setError(null);
    try {
      const blob = await api.downloadReportPdfBlob(reportId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      if (isMountedRef.current) {
        setIsDownloadingReport(false);
      }
      return true;
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setError(err instanceof ApiError ? err : new ApiError(0, (err as Error).message));
        setIsDownloadingReport(false);
      }
      return false;
    }
  }, []);

  /**
   * Soft-deletes a screening session.
   */
  const deleteSession = useCallback(async (screeningId: string): Promise<boolean> => {
    try {
      const res = await api.deleteScreening(screeningId);
      return res.success;
    } catch (err: unknown) {
      if (isMountedRef.current) {
        setError(err instanceof ApiError ? err : new ApiError(0, (err as Error).message));
      }
      return false;
    }
  }, []);

  return {
    screening,
    loading,
    error,
    isCreating,
    isUploading,
    isInferencing,
    isGeneratingXai,
    isGeneratingReport,
    isDownloadingReport,
    fetchScreening,
    createSession,
    uploadImage,
    runInference,
    generateXai,
    computeRisk,
    generateReport,
    downloadPdf,
    deleteSession,
  };
}

export default useScreening;
