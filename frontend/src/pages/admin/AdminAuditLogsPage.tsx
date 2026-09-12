/**
 * OraVisionAI — Admin Audit Logs Explorer Page (Phase 26)
 *
 * Implements full audit trail filtering, server pagination, newest-first ordering,
 * and privacy-safe detail modal inspection.
 */

import React, { useState } from 'react';
import { useAdminAuditLogs } from '../../hooks/useAdminAnalytics';
import { AuditLogsTable } from '../../components/admin/AuditLogsTable';
import { AuditLogDetailModal } from '../../components/admin/AuditLogDetailModal';
import { AdminAuditLogResponse } from '../../types/admin';
import { Badge } from '../../components/ui/Badge';
import { ErrorState } from '../../components/feedback/ErrorState';

export const AdminAuditLogsPage: React.FC = () => {
  const {
    data,
    loading,
    error,
    params,
    updateFilters,
    resetFilters,
    refetch,
  } = useAdminAuditLogs({ page: 1, page_size: 20 });

  const [selectedLog, setSelectedLog] = useState<AdminAuditLogResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const handleSelectLog = (log: AdminAuditLogResponse) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedLog(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Audit Log Explorer
            </h1>
            <Badge variant="neutral" className="text-xs uppercase font-mono">
              Immutable Log
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Query and inspect security events, administrative decisions, and clinical access audit trails.
          </p>
        </div>
      </div>

      {error ? (
        <ErrorState
          title="Failed to Retrieve Audit Logs"
          message={error}
          onRetry={refetch}
        />
      ) : (
        <AuditLogsTable
          data={data}
          loading={loading}
          params={params}
          onUpdateFilters={updateFilters}
          onResetFilters={resetFilters}
          onSelectLog={handleSelectLog}
        />
      )}

      {/* Detail Inspector Modal */}
      <AuditLogDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        auditLogId={selectedLog ? selectedLog.id : null}
        initialLog={selectedLog}
      />
    </div>
  );
};

export default AdminAuditLogsPage;
