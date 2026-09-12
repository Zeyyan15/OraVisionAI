/**
 * OraVisionAI — Clinical Screening Analytics Page (Phase 26)
 *
 * Implements screening cohort analytics strictly anchored to Screening.created_at,
 * status breakdown, 4-tier risk distributions, dentist assessments, and reports.
 */

import React from 'react';
import { useScreeningAnalytics } from '../../hooks/useAdminAnalytics';
import { ScreeningAnalyticsSection } from '../../components/admin/ScreeningAnalyticsSection';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Badge } from '../../components/ui/Badge';

export const AdminScreeningAnalyticsPage: React.FC = () => {
  const { data, loading, error, params, setParams, refetch } = useScreeningAnalytics();

  const handleDateChange = (startDate?: string, endDate?: string) => {
    setParams({
      start_date: startDate,
      end_date: endDate,
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Clinical Screening Analytics
            </h1>
            <Badge variant="info" className="text-xs uppercase font-mono">
              Cohort Telemetry
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Aggregate metrics strictly anchored to patient screening creation, 4-tier risk distributions, and clinical reports.
          </p>
        </div>
      </div>

      {error ? (
        <ErrorState
          title="Failed to Load Screening Analytics"
          message={error}
          onRetry={refetch}
        />
      ) : (
        <ScreeningAnalyticsSection
          data={data}
          loading={loading}
          params={params}
          onDateChange={handleDateChange}
          onRefresh={refetch}
        />
      )}
    </div>
  );
};

export default AdminScreeningAnalyticsPage;
