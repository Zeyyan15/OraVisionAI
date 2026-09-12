/**
 * OraVisionAI — Notification Item Component (Phase 27)
 *
 * Renders individual notification rows with semantic type icons,
 * human-readable classification, relative timestamps, and safe action navigation.
 */

import React from 'react';
import {
  FileCheck,
  AlertCircle,
  Calendar,
  CalendarCheck,
  CalendarX,
  ShieldCheck,
  Stethoscope,
  MessageSquare,
  BellRing,
} from 'lucide-react';
import { NotificationResponse, NotificationType } from '../../types/communication';

export interface NotificationItemProps {
  notification: NotificationResponse;
  onSelect?: (notification: NotificationResponse) => void;
  onMarkRead?: (id: string) => void;
  compact?: boolean;
}

function getNotificationVisuals(type: NotificationType | string) {
  switch (type) {
    case 'screening_completed':
      return {
        icon: FileCheck,
        color: 'text-emerald-600 bg-emerald-50',
        category: 'Screening Complete',
      };
    case 'screening_failed':
      return {
        icon: AlertCircle,
        color: 'text-rose-600 bg-rose-50',
        category: 'Screening Issue',
      };
    case 'appointment_booked':
      return {
        icon: Calendar,
        color: 'text-sky-600 bg-sky-50',
        category: 'Appointment Request',
      };
    case 'appointment_confirmed':
      return {
        icon: CalendarCheck,
        color: 'text-emerald-600 bg-emerald-50',
        category: 'Appointment Confirmed',
      };
    case 'appointment_cancelled':
      return {
        icon: CalendarX,
        color: 'text-amber-600 bg-amber-50',
        category: 'Appointment Cancelled',
      };
    case 'dentist_verified':
      return {
        icon: ShieldCheck,
        color: 'text-indigo-600 bg-indigo-50',
        category: 'Verification Approved',
      };
    case 'dentist_assessment_added':
      return {
        icon: Stethoscope,
        color: 'text-teal-600 bg-teal-50',
        category: 'Clinical Assessment',
      };
    case 'new_message':
      return {
        icon: MessageSquare,
        color: 'text-clinical-600 bg-clinical-50',
        category: 'New Message',
      };
    case 'system_alert':
    default:
      return {
        icon: BellRing,
        color: 'text-amber-600 bg-amber-50',
        category: 'System Alert',
      };
  }
}

function formatRelativeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onSelect,
  onMarkRead,
  compact = false,
}) => {
  const visuals = getNotificationVisuals(notification.notification_type);
  const Icon = visuals.icon;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!notification.is_read && onMarkRead) {
      onMarkRead(notification.id);
    }
    if (onSelect) {
      onSelect(notification);
    }
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent);
        }
      }}
      className={`relative flex items-start gap-3 p-3 transition-colors cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 focus:outline-none focus:bg-slate-50 ${
        !notification.is_read ? 'bg-clinical-50/40' : 'bg-white'
      } ${compact ? 'text-xs' : 'text-sm'}`}
      aria-label={`${visuals.category}: ${notification.title}`}
    >
      {/* Type Icon Badge */}
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${visuals.color}`}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Notification Body */}
      <div className="flex-1 min-w-0 pr-4">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`truncate font-semibold ${
              !notification.is_read ? 'text-slate-900 font-bold' : 'text-slate-700'
            }`}
          >
            {notification.title}
          </p>
          <span className="text-[11px] flex-shrink-0 text-slate-400">
            {formatRelativeTime(notification.created_at)}
          </span>
        </div>

        <p className="mt-0.5 text-xs text-slate-600 line-clamp-2 leading-relaxed">
          {notification.message}
        </p>

        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
            {visuals.category}
          </span>
        </div>
      </div>

      {/* Unread dot indicator */}
      {!notification.is_read && (
        <span
          className="absolute top-4 right-3 h-2 w-2 rounded-full bg-clinical-600"
          title="Unread notification"
        >
          <span className="sr-only">(Unread)</span>
        </span>
      )}
    </div>
  );
};
