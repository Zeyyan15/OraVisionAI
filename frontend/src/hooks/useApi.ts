/**
 * OraVisionAI — Lightweight Generic useApi Hook
 *
 * Provides execution state { data, loading, error, execute } for arbitrary async calls.
 * Free of domain business logic.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ApiError } from '../api/errors';

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

export interface UseApiReturn<T, P extends unknown[]> extends UseApiState<T> {
  execute: (...args: P) => Promise<T | null>;
  reset: () => void;
}

export function useApi<T, P extends unknown[] = []>(
  apiFn: (...args: P) => Promise<T>,
): UseApiReturn<T, P> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);

  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
  }, []);

  const execute = useCallback(
    async (...args: P): Promise<T | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiFn(...args);
        if (isMountedRef.current) {
          setData(result);
          setLoading(false);
        }
        return result;
      } catch (err: unknown) {
        if (isMountedRef.current) {
          if (err instanceof ApiError) {
            setError(err);
          } else {
            setError(new ApiError(0, (err as Error)?.message || 'An unexpected error occurred.'));
          }
          setLoading(false);
        }
        return null;
      }
    },
    [apiFn],
  );

  return { data, loading, error, execute, reset };
}

export default useApi;
