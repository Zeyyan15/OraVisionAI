/**
 * OraVisionAI — Notification Popover Component (Phase 27)
 *
 * Universal dropdown panel rendered from Header.
 * Displays recent alerts, quick "Mark All Read" action, and "View All" link.
 */

import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, ExternalLink, BellOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { NotificationResponse } from '../../types/communication';
import { resolveSafeActionUrl } from '../../utils/actionUrlResolver';
import { NotificationItem } from './NotificationItem';
import { Button } from '../ui/Button';

export interface NotificationPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationResponse[];
  unreadCount: number;
  loading: boolean;
  onMarkRead: (id: string) => Promise<unknown>;
  onMarkAllRead: () => Promise<unknown>;
}

export const NotificationPopover: React.FC<NotificationPopoverProps> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  loading,
  onMarkRead,
  onMarkAllRead,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  // Close on Escape key or outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const role = userProfile?.role || 'patient';

  const handleSelectNotification = (notification: NotificationResponse) => {
    onClose();
    const safeTarget = resolveSafeActionUrl(notification.action_url, role);
    navigate(safeTarget);
  };

  const handleViewAll = () => {
    onClose();
    if (role === 'dentist') {
      navigate('/dentist/notifications');
    } else if (role === 'admin') {
      navigate('/admin/notifications');
    } else {
      navigate('/patient/notifications');
    }
  };

  // Display top 8 recent notifications in popover
  const recentItems = notifications.slice(0, 8);

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-label="Notification center"
      className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 animate-in fade-in-50 zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/70 rounded-t-xl">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
          {unreadCount > 0 && (
            <span className="rounded-full bg-clinical-100 px-2 py-0.5 text-[11px] font-bold text-clinical-800">
              {unreadCount} new
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => onMarkAllRead()}
            className="inline-flex items-center gap-1 text-xs font-semibold text-clinical-600 hover:text-clinical-700 transition-colors"
            title="Mark all as read"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Notifications Scroll Area */}
      <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
        {loading && notifications.length === 0 ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="h-8 w-8 rounded-lg bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-3/4 rounded bg-slate-200" />
                  <div className="h-3 w-5/6 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : recentItems.length === 0 ? (
          <div className="py-8 px-4 text-center">
            <BellOff className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-xs font-semibold text-slate-700">No notifications yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              You are completely caught up with your clinical updates.
            </p>
          </div>
        ) : (
          recentItems.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              compact
              onSelect={handleSelectNotification}
              onMarkRead={onMarkRead}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 p-2 text-center bg-slate-50/50 rounded-b-xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleViewAll}
          className="w-full text-xs font-semibold text-clinical-600 hover:text-clinical-800 flex items-center justify-center gap-1.5"
        >
          <span>View all notifications</span>
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};
