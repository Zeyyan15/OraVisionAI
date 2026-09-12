/**
 * OraVisionAI — Platform Overview KPI Cards (Phase 26)
 *
 * Renders platform-level operational telemetry across users, dentist verifications,
 * clinical screenings, telehealth appointments, teleconsultations, messaging, and audit logs.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  PlatformOverviewAnalyticsResponse,
} from '../../types/admin';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  Users,
  ShieldCheck,
  Activity,
  Video,
  MessageSquare,
  ClipboardList,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

export interface OverviewKpiCardsProps {
  data: PlatformOverviewAnalyticsResponse;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const OverviewKpiCards: React.FC<OverviewKpiCardsProps> = ({
  data,
  onRefresh,
  isRefreshing = false,
}) => {
  const {
    users,
    dentist_verifications,
    screenings,
    telehealth,
    communication,
    total_audit_logs,
    generated_at,
  } = data;

  // Format generated_at timestamp
  const formattedTimestamp = new Date(generated_at).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  return (
    <div className="space-y-6">
      {/* Header bar with snapshot metadata and refresh trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-900">Platform Operational Telemetry</h2>
            <Badge variant="success" className="text-xs">Live System</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Snapshot calculated: <span className="font-mono font-medium text-slate-700">{formattedTimestamp}</span>
          </p>
        </div>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            leftIcon={RefreshCw}
            className={isRefreshing ? 'animate-spin-icon' : ''}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh Telemetry'}
          </Button>
        )}
      </div>

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* 1. User Directory */}
        <Card className="hover:border-slate-300 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-900">Platform Users</CardTitle>
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <CardDescription className="text-xs">Registered identity accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold tracking-tight text-slate-900">{users.total_users}</span>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                <span className="text-emerald-600">{users.active_users} active</span>
                <span>•</span>
                <span className="text-slate-400">{users.inactive_users} inactive</span>
              </div>
            </div>

            {/* Role Breakdown Bar */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Role Composition</span>
                <span>{users.patient_count} P / {users.dentist_count} D / {users.admin_count} A</span>
              </div>
              <div className="flex h-2 w-full rounded-full overflow-hidden bg-slate-100" role="region" aria-label="User role distribution">
                {users.total_users > 0 ? (
                  <>
                    <div
                      style={{ width: `${(users.patient_count / users.total_users) * 100}%` }}
                      className="bg-indigo-500 transition-all"
                      title={`Patients: ${users.patient_count}`}
                    />
                    <div
                      style={{ width: `${(users.dentist_count / users.total_users) * 100}%` }}
                      className="bg-teal-500 transition-all"
                      title={`Dentists: ${users.dentist_count}`}
                    />
                    <div
                      style={{ width: `${(users.admin_count / users.total_users) * 100}%` }}
                      className="bg-purple-500 transition-all"
                      title={`Admins: ${users.admin_count}`}
                    />
                  </>
                ) : (
                  <div className="w-full bg-slate-200" />
                )}
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Patients</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-teal-500" /> Dentists</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> Admins</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Practitioner Verification */}
        <Card className="hover:border-slate-300 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-900">Dentist Verifications</CardTitle>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
            <CardDescription className="text-xs">Practitioner license credentials</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold tracking-tight text-slate-900">
                {dentist_verifications.total_verifications}
              </span>
              {dentist_verifications.pending_verifications > 0 ? (
                <Badge variant="warning" className="text-xs">
                  {dentist_verifications.pending_verifications} Pending Review
                </Badge>
              ) : (
                <Badge variant="neutral" className="text-xs">All Reviewed</Badge>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                <p className="text-[11px] text-slate-500">Pending</p>
                <p className="text-sm font-semibold text-amber-600">{dentist_verifications.pending_verifications}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                <p className="text-[11px] text-slate-500">Approved</p>
                <p className="text-sm font-semibold text-emerald-600">{dentist_verifications.approved_verifications}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
                <p className="text-[11px] text-slate-500">Rejected</p>
                <p className="text-sm font-semibold text-rose-600">{dentist_verifications.rejected_verifications}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Clinical Screening Pipeline */}
        <Card className="hover:border-slate-300 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-900">Screening Pipeline</CardTitle>
              <div className="p-2 rounded-lg bg-teal-50 text-teal-600">
                <Activity className="h-5 w-5" />
              </div>
            </div>
            <CardDescription className="text-xs">Non-deleted clinical screenings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold tracking-tight text-slate-900">{screenings.total_screenings}</span>
              <span className="text-xs text-slate-500 font-medium">
                {screenings.completed_screenings} Completed
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 pt-1 text-center">
              <div className="rounded bg-slate-50 p-1.5 border border-slate-100">
                <p className="text-[10px] text-slate-500">Pending</p>
                <p className="text-xs font-semibold text-slate-700">{screenings.pending_screenings}</p>
              </div>
              <div className="rounded bg-slate-50 p-1.5 border border-slate-100">
                <p className="text-[10px] text-slate-500">Process</p>
                <p className="text-xs font-semibold text-amber-600">{screenings.processing_screenings}</p>
              </div>
              <div className="rounded bg-slate-50 p-1.5 border border-slate-100">
                <p className="text-[10px] text-slate-500">Done</p>
                <p className="text-xs font-semibold text-emerald-600">{screenings.completed_screenings}</p>
              </div>
              <div className="rounded bg-slate-50 p-1.5 border border-slate-100">
                <p className="text-[10px] text-slate-500">Failed</p>
                <p className="text-xs font-semibold text-rose-600">{screenings.failed_screenings}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Telehealth Sessions */}
        <Card className="hover:border-slate-300 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-900">Telehealth Utilization</CardTitle>
              <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
                <Video className="h-5 w-5" />
              </div>
            </div>
            <CardDescription className="text-xs">Appointments & live sessions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-3xl font-bold tracking-tight text-slate-900">
                  {telehealth.total_appointments}
                </span>
                <span className="text-xs text-slate-400 ml-1">appts</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-slate-800">{telehealth.total_consultations}</span>
                <span className="text-xs text-slate-400 ml-1">calls</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-600">Completed Sessions:</span>
              <span className="font-semibold text-slate-900">
                {telehealth.completed_appointments} appts / {telehealth.ended_consultations} calls
              </span>
            </div>
          </CardContent>
        </Card>

        {/* 5. Platform Communication */}
        <Card className="hover:border-slate-300 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-900">Patient–Dentist Chat</CardTitle>
              <div className="p-2 rounded-lg bg-violet-50 text-violet-600">
                <MessageSquare className="h-5 w-5" />
              </div>
            </div>
            <CardDescription className="text-xs">Secure clinical messaging</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold tracking-tight text-slate-900">
                {communication.total_messages}
              </span>
              <span className="text-xs text-slate-500 font-medium">Messages Sent</span>
            </div>

            <div className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-600">Active Conversations:</span>
              <span className="font-semibold text-slate-900">{communication.total_conversations}</span>
            </div>
          </CardContent>
        </Card>

        {/* 6. Security Audit Trail */}
        <Card className="hover:border-slate-300 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-900">Audit Compliance</CardTitle>
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <ClipboardList className="h-5 w-5" />
              </div>
            </div>
            <CardDescription className="text-xs">Immutable security & clinical log</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold tracking-tight text-slate-900">{total_audit_logs}</span>
              <span className="text-xs text-slate-500 font-medium">Events Recorded</span>
            </div>

            <div className="flex items-center justify-between text-xs py-2 px-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-600">Integrity Status:</span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Append-Only
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Domain Navigation Shortcuts */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Platform Oversight Modules</h3>
          <p className="text-xs text-slate-500">
            Access deep-dive analytical dashboards, model registries, and regulatory inspection logs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          <Link
            to="/admin/audit-logs"
            className="group flex items-start gap-3 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
          >
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700">Audit Logs</h4>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                Filter and inspect security, clinical access, and system event trails with privacy redaction.
              </p>
            </div>
          </Link>

          <Link
            to="/admin/analytics/screenings"
            className="group flex items-start gap-3 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
          >
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">
              <Activity className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700">Screening Analytics</h4>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                Temporal cohort tracking anchored to screening creation, 4-tier risk distributions, and reports.
              </p>
            </div>
          </Link>

          <Link
            to="/admin/analytics/ai-telemetry"
            className="group flex items-start gap-3 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
          >
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700">AI Telemetry</h4>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                Operational inference metrics, 7-class lesion distributions, average confidence, and YOLO counts.
              </p>
            </div>
          </Link>

          <Link
            to="/admin/analytics/telehealth"
            className="group flex items-start gap-3 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
          >
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">
              <Video className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700">Telehealth Analytics</h4>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                Appointment statuses (7 states), cancellation rates, consultation statuses, and duration averages.
              </p>
            </div>
          </Link>

          <Link
            to="/admin/ai-models"
            className="group flex items-start gap-3 p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
          >
            <div className="p-2 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700">AI Model Registry</h4>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </div>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                Inspect registered neural networks, version parameters, and target layers with zero path exposure.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OverviewKpiCards;
