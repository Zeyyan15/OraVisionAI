/**
 * OraVisionAI — Admin Oversight Console & Platform Overview (Phase 26)
 *
 * Displays live platform operational telemetry across users, dentist verifications,
 * clinical screenings, telehealth appointments, teleconsultations, messaging, and audit volume.
 */

import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useAdminOverview } from '../../hooks/useAdminAnalytics';
import { OverviewKpiCards } from '../../components/admin/OverviewKpiCards';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Badge } from '../../components/ui/Badge';

export const AdminDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const { data, loading, error, refetch } = useAdminOverview();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Platform Administration Console
            </h1>
            <Badge variant="info" className="text-xs uppercase font-mono">
              Admin Oversight
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Administrator: <strong className="text-slate-800">{userProfile?.first_name} {userProfile?.last_name}</strong> ({userProfile?.email})
          </p>
        </div>
      </div>

      {/* Main Content Body */}
      {loading && !data ? (
        <LoadingSkeleton variant="card" count={4} />
      ) : error ? (
        <ErrorState
          title="Unable to Load Platform Telemetry"
          message={error}
          onRetry={refetch}
        />
      ) : data ? (
        <OverviewKpiCards data={data} onRefresh={refetch} isRefreshing={loading} />
      ) : null}
    </div>
  );
};

export default AdminDashboard;
