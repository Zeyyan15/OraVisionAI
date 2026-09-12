/**
 * OraVisionAI — Telehealth Utilization Analytics Page (Phase 26)
 *
 * Displays appointment scheduling status distribution (all 7 statuses),
 * appointment cancellation rates, consultation states (4 statuses), and duration metrics.
 */

import React from 'react';
import { useTelehealthAnalytics } from '../../hooks/useAdminAnalytics';
import { TelehealthAnalyticsSection } from '../../components/admin/TelehealthAnalyticsSection';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Badge } from '../../components/ui/Badge';

export const AdminTelehealthAnalyticsPage: React.FC = () => {
  const { data, loading, error, refetch } = useTelehealthAnalytics();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Telehealth Utilization Analytics
            </h1>
            <Badge variant="info" className="text-xs uppercase font-mono">
              Clinical Telehealth
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Appointment lifecycle metrics across 7 statuses, cancellation rates, live consultation durations, and session counts.
          </p>
        </div>
      </div>

      {error ? (
        <ErrorState
          title="Failed to Load Telehealth Analytics"
          message={error}
          onRetry={refetch}
        />
      ) : (
        <TelehealthAnalyticsSection
          data={data}
          loading={loading}
          onRefresh={refetch}
        />
      )}
    </div>
  );
};

export default AdminTelehealthAnalyticsPage;
