/**
 * OraVisionAI — AI Inference Telemetry Page (Phase 26)
 *
 * Displays operational model inference counts, 7-class lesion taxonomy distributions,
 * average prediction confidence (strictly NOT labeled accuracy), and YOLO/XAI counts.
 */

import React from 'react';
import { useAITelemetry } from '../../hooks/useAdminAnalytics';
import { AITelemetrySection } from '../../components/admin/AITelemetrySection';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Badge } from '../../components/ui/Badge';

export const AdminAITelemetryPage: React.FC = () => {
  const { data, loading, error, refetch } = useAITelemetry();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              AI Inference Telemetry & Oversight
            </h1>
            <Badge variant="info" className="text-xs uppercase font-mono">
              Model Operations
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Operational inference volume, 7-class lesion distributions, average confidence scores, and vision model telemetry.
          </p>
        </div>
      </div>

      {error ? (
        <ErrorState
          title="Failed to Load AI Telemetry"
          message={error}
          onRetry={refetch}
        />
      ) : (
        <AITelemetrySection
          data={data}
          loading={loading}
          onRefresh={refetch}
        />
      )}
    </div>
  );
};

export default AdminAITelemetryPage;
