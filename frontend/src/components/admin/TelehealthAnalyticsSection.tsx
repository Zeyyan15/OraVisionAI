/**
 * OraVisionAI — Telehealth Utilization Analytics Section (Phase 26)
 *
 * Implements telehealth scheduling analytics across all 7 appointment statuses,
 * cancellation rate metrics, 4 consultation session states, and duration telemetry.
 */

import React from 'react';
import { TelehealthAnalyticsResponse } from '../../types/admin';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSkeleton } from '../feedback/LoadingSkeleton';
import {
  Calendar,
  Video,
  Clock,
  RefreshCw,
  XCircle,
} from 'lucide-react';

export interface TelehealthAnalyticsSectionProps {
  data: TelehealthAnalyticsResponse | null;
  loading: boolean;
  onRefresh: () => void;
}

export const TelehealthAnalyticsSection: React.FC<TelehealthAnalyticsSectionProps> = ({
  data,
  loading,
  onRefresh,
}) => {
  // Helpers for duration formatting
  const formatTotalDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const formatAvgDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Telehealth Utilization Analytics</h2>
          <p className="text-xs text-slate-500">
            Appointment scheduling lifecycle, live teleconsultation statuses, and duration averages.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          leftIcon={RefreshCw}
          className="text-xs"
        >
          Refresh Telehealth
        </Button>
      </div>

      {loading ? (
        <LoadingSkeleton variant="card" count={3} />
      ) : data ? (
        <div className="space-y-6">
          {/* Primary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Total Appointments</p>
                  <p className="text-2xl font-bold text-slate-900 mt-0.5">{data.total_appointments}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <Calendar className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Cancellation Rate</p>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-2xl font-bold text-slate-900 font-mono">
                      {data.appointment_cancellation_rate.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600">
                  <XCircle className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Total Consultations</p>
                  <p className="text-2xl font-bold text-slate-900 mt-0.5">{data.total_consultations}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-sky-50 text-sky-600">
                  <Video className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Average Duration</p>
                  <p className="text-2xl font-bold text-slate-900 font-mono mt-0.5">
                    {formatAvgDuration(data.average_ended_consultation_duration_seconds)}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-teal-50 text-teal-600">
                  <Clock className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* All 7 Appointment Statuses Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Appointment Lifecycle States (All 7 Statuses)</CardTitle>
              <CardDescription className="text-xs">
                Authoritative distribution across appointment scheduling states
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
                {Object.entries(data.appointment_status_breakdown).map(([st, count]) => (
                  <div key={st} className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      {st.replace('_', ' ')}
                    </p>
                    <p className="text-lg font-bold text-slate-900 mt-1">{count}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* All 4 Consultation Statuses & Duration Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Consultation Session Statuses</CardTitle>
                <CardDescription className="text-xs">Live teleconsultation state distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  {Object.entries(data.consultation_status_breakdown).map(([st, count]) => (
                    <div key={st} className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{st}</p>
                      <p className="text-lg font-bold text-slate-900 mt-1">{count}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Teleconsultation Duration Telemetry</CardTitle>
                <CardDescription className="text-xs">Duration tracking for ended sessions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-xs text-slate-600 font-medium">Total Ended Clinical Time:</span>
                  <span className="text-sm font-bold font-mono text-slate-900">
                    {formatTotalDuration(data.total_ended_consultation_duration_seconds)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-xs text-slate-600 font-medium">Mean Session Duration:</span>
                  <span className="text-sm font-bold font-mono text-slate-900">
                    {formatAvgDuration(data.average_ended_consultation_duration_seconds)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TelehealthAnalyticsSection;
