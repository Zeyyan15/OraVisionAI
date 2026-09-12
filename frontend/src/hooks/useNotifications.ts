/**
 * OraVisionAI — In-App Notifications Custom Hook (Phase 27)
 *
 * Provides reactive management of user notifications, unread counters,
 * read state mutations, and visibility-aware interval polling.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  NotificationResponse,
  NotificationQueryParams,
} from '../types/communication';
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api/communicationEndpoints';

export interface UseNotificationsOptions {
  enablePolling?: boolean;
  pollIntervalMs?: number; // Default: 60,000ms (60s)
  initialParams?: NotificationQueryParams;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const {
    enablePolling = true,
    pollIntervalMs = 60000,
    initialParams = { limit: 50, offset: 0 },
  } = options;

  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<NotificationQueryParams>(initialParams);

  const isMountedRef = useRef<boolean>(true);

  // Fetch full notification list
  const fetchNotifications = useCallback(
    async (customParams?: NotificationQueryParams) => {
      setLoading(true);
      setError(null);
      try {
        const query = customParams || params;
        const res = await listNotifications(query);
        if (isMountedRef.current) {
          setNotifications(res.items);
          setTotal(res.total);
          setUnreadCount(res.unread_count);
        }
      } catch (err: unknown) {
        if (isMountedRef.current) {
          const msg = err instanceof Error ? err.message : 'Failed to retrieve notifications';
          setError(msg);
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [params],
  );

  // Lightweight fetch for badge unread count only
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await getUnreadNotificationCount();
      if (isMountedRef.current) {
        setUnreadCount(res.unread_count);
      }
    } catch {
      // Silently ignore badge polling errors to avoid noisy toast alerts
    }
  }, []);

  // Mark single notification as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      const updated = await markNotificationRead(id);
      if (isMountedRef.current) {
        setNotifications((prev) =>
          prev.map((item) => (item.id === id ? { ...item, is_read: true, read_at: updated.read_at } : item)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      return updated;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to mark notification as read';
      throw new Error(msg);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const res = await markAllNotificationsRead();
      if (isMountedRef.current) {
        setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
        setUnreadCount(0);
      }
      return res.marked_read_count;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to mark all notifications as read';
      throw new Error(msg);
    }
  }, []);

  // Initial load
  useEffect(() => {
    isMountedRef.current = true;
    fetchNotifications();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchNotifications]);

  // Visibility-aware background polling for unread count
  useEffect(() => {
    if (!enablePolling) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const startTimer = () => {
      if (!timer) {
        timer = setInterval(() => {
          if (document.visibilityState === 'visible') {
            fetchUnreadCount();
          }
        }, pollIntervalMs);
      }
    };

    const stopTimer = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCount();
        startTimer();
      } else {
        stopTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    startTimer();

    return () => {
      stopTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enablePolling, pollIntervalMs, fetchUnreadCount]);

  return {
    notifications,
    unreadCount,
    total,
    loading,
    error,
    params,
    setParams,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
