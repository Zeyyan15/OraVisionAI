import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { messageOf } from '../utils/consultation';

export function useResource<T>(loader: (signal?: AbortSignal) => Promise<T>, pollMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(loader);
  useEffect(() => { loadRef.current = loader; }, [loader]);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const refresh = useCallback(async (silent = false) => {
    if (busy.current && !controller.current?.signal.aborted) return;
    busy.current = true;
    const active = new AbortController(); controller.current = active;
    if (!silent) setLoading(true);
    try {
      const value = await loadRef.current(active.signal);
      if (!active.signal.aborted && mounted.current) { setData(value); setError(null); }
    } catch (failure) {
      if (!active.signal.aborted && mounted.current) setError(messageOf(failure));
    } finally {
      if (controller.current === active) busy.current = false;
      if (mounted.current && !active.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  useFocusEffect(useCallback(() => {
    void refresh();
    const timer = pollMs ? setInterval(() => { if (AppState.currentState === 'active') void refresh(true); }, pollMs) : undefined;
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(true); });
    return () => { if (timer) clearInterval(timer); listener.remove(); controller.current?.abort(); };
  }, [refresh, pollMs]));
  return { data, setData, loading, error, refresh };
}
