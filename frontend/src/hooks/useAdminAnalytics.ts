/**
 * OraVisionAI — Admin Analytics & Oversight Custom Hook (Phase 26)
 *
 * Provides reactive async fetching, error handling, manual refetching,
 * pagination, and filter parameter management across all 8 Phase 18 operations.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  PlatformOverviewAnalyticsResponse,
  AdminAuditLogListResponse,
  AuditLogQueryParams,
  ClinicalScreeningAnalyticsResponse,
  ScreeningAnalyticsQueryParams,
  AITelemetryAnalyticsResponse,
  TelehealthAnalyticsResponse,
  AIModelListResponse,
  AIModelResponse,
  AdminAuditLogResponse,
} from '../types/admin';
import {
  getPlatformOverview,
  listAuditLogs,
  getAuditLogDetail,
  getScreeningAnalytics,
  getAITelemetry,
  getTelehealthAnalytics,
  listAIModels,
  getAIModelDetail,
} from '../api/adminEndpoints';

export function useAdminOverview() {
  const [data, setData] = useState<PlatformOverviewAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPlatformOverview();
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load platform overview';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return { data, loading, error, refetch: fetchOverview };
}

export function useAdminAuditLogs(initialParams: AuditLogQueryParams = { page: 1, page_size: 20 }) {
  const [params, setParams] = useState<AuditLogQueryParams>(initialParams);
  const [data, setData] = useState<AdminAuditLogListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listAuditLogs(params);
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve audit logs';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const updateFilters = useCallback((newFilters: Partial<AuditLogQueryParams>) => {
    setParams((prev) => ({
      ...prev,
      ...newFilters,
      // Reset to page 1 if search criteria change, unless explicitly paging
      page: newFilters.page !== undefined ? newFilters.page : 1,
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setParams({ page: 1, page_size: 20 });
  }, []);

  return {
    data,
    loading,
    error,
    params,
    setParams,
    updateFilters,
    resetFilters,
    refetch: fetchLogs,
  };
}

export function useScreeningAnalytics(initialParams: ScreeningAnalyticsQueryParams = {}) {
  const [params, setParams] = useState<ScreeningAnalyticsQueryParams>(initialParams);
  const [data, setData] = useState<ClinicalScreeningAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getScreeningAnalytics(params);
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load screening analytics';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return { data, loading, error, params, setParams, refetch: fetchAnalytics };
}

export function useAITelemetry() {
  const [data, setData] = useState<AITelemetryAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTelemetry = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAITelemetry();
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load AI telemetry';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  return { data, loading, error, refetch: fetchTelemetry };
}

export function useTelehealthAnalytics() {
  const [data, setData] = useState<TelehealthAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTelehealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTelehealthAnalytics();
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load telehealth analytics';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTelehealth();
  }, [fetchTelehealth]);

  return { data, loading, error, refetch: fetchTelehealth };
}

export function useAIModels() {
  const [data, setData] = useState<AIModelListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listAIModels();
      setData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load AI models catalog';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return { data, loading, error, refetch: fetchModels };
}

export async function fetchAuditLogDetailDirect(auditLogId: string): Promise<AdminAuditLogResponse> {
  return getAuditLogDetail(auditLogId);
}

export async function fetchAIModelDetailDirect(modelId: string): Promise<AIModelResponse> {
  return getAIModelDetail(modelId);
}
