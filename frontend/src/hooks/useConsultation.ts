/**
 * OraVisionAI — Consultation Lifecycle React Hook (Phase 25)
 *
 * Manages consultation state, 4-second polling synchronization,
 * elapsed session duration timer, and lifecycle actions (start, end, fail).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ConsultationResponse,
  ConsultationEnd,
} from '../types/consultation';
import {
  getConsultation,
  startConsultation as apiStart,
  endConsultation as apiEnd,
  failConsultation as apiFail,
} from '../api/consultations';



const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred';
};

export function useConsultation(consultationId: string | undefined) {
  const [consultation, setConsultation] = useState<ConsultationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchConsultation = useCallback(async (silent = false) => {
    if (!consultationId) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await getConsultation(consultationId);
      setConsultation(data);
      if (data.session_status === 'active' && data.started_at) {
        const startMs = new Date(data.started_at).getTime();
        const nowMs = Date.now();
        setElapsedSeconds(Math.max(0, Math.floor((nowMs - startMs) / 1000)));
      } else if (data.duration_seconds) {
        setElapsedSeconds(data.duration_seconds);
      }
    } catch (err) {
      if (!silent) setError(getErrorMessage(err));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [consultationId]);

  useEffect(() => {
    fetchConsultation();
  }, [fetchConsultation]);

  // 4-second polling timer for active or scheduled sessions
  useEffect(() => {
    if (!consultationId) return;

    pollingRef.current = setInterval(() => {
      fetchConsultation(true);
    }, 4000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [consultationId, fetchConsultation]);

  // 1-second elapsed timer during active sessions
  useEffect(() => {
    if (consultation?.session_status === 'active') {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [consultation?.session_status]);

  const startSession = async () => {
    if (!consultationId) return;
    setActionLoading(true);
    setError(null);
    try {
      const updated = await apiStart(consultationId);
      setConsultation(updated);
      return updated;
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      throw new Error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const endSession = async (payload?: ConsultationEnd) => {
    if (!consultationId) return;
    setActionLoading(true);
    setError(null);
    try {
      const updated = await apiEnd(consultationId, payload);
      setConsultation(updated);
      return updated;
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      throw new Error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const failSession = async () => {
    if (!consultationId) return;
    setActionLoading(true);
    setError(null);
    try {
      const updated = await apiFail(consultationId);
      setConsultation(updated);
      return updated;
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      throw new Error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  return {
    consultation,
    loading,
    actionLoading,
    error,
    elapsedSeconds,
    refetch: fetchConsultation,
    startSession,
    endSession,
    failSession,
  };
}
