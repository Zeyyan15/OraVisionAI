/**
 * OraVisionAI — Universal Notification Center Page (Phase 27)
 *
 * Dedicated full-page view supporting Patient, Dentist, and Admin roles.
 * Provides complete notification history, read/unread filters, pagination,
 * atomic mark-all-read, and safe action URL navigation.
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  RefreshCw,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  BellOff,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { resolveSafeActionUrl, getRoleDashboard } from '../../utils/actionUrlResolver';
import { NotificationItem } from '../../components/notifications/NotificationItem';
import { NotificationResponse } from '../../types/communication';
import { Button } from '../../components/ui/Button';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const role = userProfile?.role || 'patient';
  const dashboardUrl = getRoleDashboard(role);

  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  const {
    notifications,
    unreadCount,
    total,
    loading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications({
    enablePolling: true,
    pollIntervalMs: 60000,
    initialParams: {
      is_read: activeTab === 'unread' ? false : undefined,
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
    },
  });

  const handleTabChange = (tab: 'all' | 'unread') => {
    setActiveTab(tab);
    setCurrentPage(1);
    fetchNotifications({
      is_read: tab === 'unread' ? false : undefined,
      limit: pageSize,
      offset: 0,
    });
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchNotifications({
      is_read: activeTab === 'unread' ? false : undefined,
      limit: pageSize,
      offset: (newPage - 1) * pageSize,
    });
  };

  const handleSelectNotification = (notification: NotificationResponse) => {
    const safeTarget = resolveSafeActionUrl(notification.action_url, role);
    navigate(safeTarget);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb & Header */}
      <div>
        <Link
          to={dashboardUrl}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 mb-2 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Bell className="h-6 w-6 text-clinical-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Notification Center
            </h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-clinical-100 px-2.5 py-0.5 text-xs font-bold text-clinical-800">
                {unreadCount} unread
              </span>
            )}
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                fetchNotifications({
                  is_read: activeTab === 'unread' ? false : undefined,
                  limit: pageSize,
                  offset: (currentPage - 1) * pageSize,
                })
              }
              disabled={loading}
              className="text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>

            {unreadCount > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => markAllAsRead()}
                className="text-xs flex items-center gap-1.5"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark all as read</span>
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Review system notices, appointment confirmations, and clinical workflow updates.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => handleTabChange('all')}
          className={`py-2 px-4 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'border-clinical-600 text-clinical-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          All Notifications ({total})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('unread')}
          className={`py-2 px-4 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'unread'
              ? 'border-clinical-600 text-clinical-700 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Unread Only ({unreadCount})
        </button>
      </div>

      {/* Notifications Table / List Card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading && notifications.length === 0 ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="h-10 w-10 rounded-lg bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded bg-slate-200" />
                  <div className="h-3 w-3/4 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-xs text-rose-600 font-semibold">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNotifications()}
              className="mt-3 text-xs"
            >
              Retry
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center">
            <BellOff className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-3 text-sm font-bold text-slate-700">No notifications found</h3>
            <p className="mt-1 text-xs text-slate-400">
              {activeTab === 'unread'
                ? 'You have no unread notifications.'
                : 'Your notification center is currently empty.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                notification={n}
                onSelect={handleSelectNotification}
                onMarkRead={markAsRead}
              />
            ))}
          </div>
        )}

        {/* Pagination Footer */}
        {total > pageSize && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 bg-slate-50/60">
            <span className="text-xs text-slate-500">
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(total, currentPage * pageSize)} of {total} notifications
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1 || loading}
                className="text-xs px-2.5 flex items-center gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Previous</span>
              </Button>
              <span className="text-xs font-semibold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || loading}
                className="text-xs px-2.5 flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
