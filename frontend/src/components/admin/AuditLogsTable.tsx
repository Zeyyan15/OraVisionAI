/**
 * OraVisionAI — Filterable, Paginated Audit Logs Table (Phase 26)
 *
 * Implements server-side filtering (action, resource_type, user_id, start_date, end_date),
 * pagination, newest-first server ordering, and click-to-inspect detail modal binding.
 */

import React, { useState } from 'react';
import {
  AdminAuditLogResponse,
  AdminAuditLogListResponse,
  AuditLogQueryParams,
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
} from '../../types/admin';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { LoadingSkeleton } from '../feedback/LoadingSkeleton';
import { EmptyState } from '../feedback/EmptyState';
import {
  Filter,
  RotateCcw,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';

export interface AuditLogsTableProps {
  data: AdminAuditLogListResponse | null;
  loading: boolean;
  params: AuditLogQueryParams;
  onUpdateFilters: (filters: Partial<AuditLogQueryParams>) => void;
  onResetFilters: () => void;
  onSelectLog: (log: AdminAuditLogResponse) => void;
}

export const AuditLogsTable: React.FC<AuditLogsTableProps> = ({
  data,
  loading,
  params,
  onUpdateFilters,
  onResetFilters,
  onSelectLog,
}) => {
  // Local form state for filters
  const [selectedAction, setSelectedAction] = useState<string>(params.action || '');
  const [selectedResource, setSelectedResource] = useState<string>(params.resource_type || '');
  const [userIdInput, setUserIdInput] = useState<string>(params.user_id || '');
  const [startDate, setStartDate] = useState<string>(params.start_date ? params.start_date.substring(0, 10) : '');
  const [endDate, setEndDate] = useState<string>(params.end_date ? params.end_date.substring(0, 10) : '');
  const [dateError, setDateError] = useState<string | null>(null);

  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setDateError(null);

    // Validate date boundary
    if (startDate && endDate && startDate > endDate) {
      setDateError('Start date cannot be after end date.');
      return;
    }

    // Format calendar dates to UTC ISO boundary strings without timezone day-shifting
    const formattedStart = startDate ? `${startDate}T00:00:00Z` : undefined;
    const formattedEnd = endDate ? `${endDate}T23:59:59Z` : undefined;

    onUpdateFilters({
      action: selectedAction || undefined,
      resource_type: selectedResource || undefined,
      user_id: userIdInput.trim() || undefined,
      start_date: formattedStart,
      end_date: formattedEnd,
      page: 1, // Reset to first page
    });
  };

  const handleReset = () => {
    setSelectedAction('');
    setSelectedResource('');
    setUserIdInput('');
    setStartDate('');
    setEndDate('');
    setDateError(null);
    onResetFilters();
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && (!data || newPage <= data.total_pages)) {
      onUpdateFilters({ page: newPage });
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    onUpdateFilters({ page_size: newSize, page: 1 });
  };

  return (
    <div className="space-y-4">
      {/* Filter Toolbar Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-900">Filter Audit Trail</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              leftIcon={RotateCcw}
              className="text-xs"
            >
              Reset Filters
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApplyFilters}
              leftIcon={Search}
              className="text-xs"
            >
              Apply Filters
            </Button>
          </div>
        </div>

        <form onSubmit={handleApplyFilters} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Action Filter */}
          <div>
            <label htmlFor="audit-action-filter" className="block font-medium text-slate-700 mb-1">
              Audit Action
            </label>
            <select
              id="audit-action-filter"
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All Actions (Any)</option>
              {AUDIT_ACTIONS.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          {/* Resource Type Filter */}
          <div>
            <label htmlFor="audit-resource-filter" className="block font-medium text-slate-700 mb-1">
              Resource Type
            </label>
            <select
              id="audit-resource-filter"
              value={selectedResource}
              onChange={(e) => setSelectedResource(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All Resources (Any)</option>
              {AUDIT_RESOURCE_TYPES.map((res) => (
                <option key={res} value={res}>
                  {res}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label htmlFor="audit-start-date" className="block font-medium text-slate-700 mb-1">
              From Date
            </label>
            <input
              id="audit-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label htmlFor="audit-end-date" className="block font-medium text-slate-700 mb-1">
              To Date
            </label>
            <input
              id="audit-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* User ID Optional Advanced Filter */}
          <div className="sm:col-span-2 lg:col-span-4 pt-1">
            <details className="text-xs text-slate-600">
              <summary className="cursor-pointer font-medium text-indigo-600 hover:text-indigo-800 select-none">
                Advanced Filter: Search by Actor User ID
              </summary>
              <div className="mt-2 max-w-md">
                <input
                  type="text"
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  value={userIdInput}
                  onChange={(e) => setUserIdInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </details>
          </div>
        </form>

        {dateError && (
          <p className="text-xs font-medium text-rose-600 pt-1" role="alert">
            {dateError}
          </p>
        )}
      </div>

      {/* Audit Log Table View */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <LoadingSkeleton variant="table" count={5} />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Audit Logs Found"
              description="No audit trail events match the selected criteria. Try adjusting date boundaries or clearing active filters."
              actionLabel="Reset Filters"
              onAction={handleReset}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse" aria-label="Audit Logs Table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <th scope="col" className="py-3 px-4">Timestamp (UTC / Local)</th>
                  <th scope="col" className="py-3 px-4">Actor</th>
                  <th scope="col" className="py-3 px-4">Action</th>
                  <th scope="col" className="py-3 px-4">Target Resource</th>
                  <th scope="col" className="py-3 px-4">Client IP</th>
                  <th scope="col" className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data.items.map((log) => {
                  const dateObj = new Date(log.timestamp);
                  const localTime = dateObj.toLocaleTimeString();
                  const localDate = dateObj.toLocaleDateString();
                  const utcIso = dateObj.toISOString();

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => onSelectLog(log)}
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap" title={`UTC: ${utcIso}`}>
                        <div className="font-mono text-slate-900 font-medium">{localDate}</div>
                        <div className="font-mono text-slate-400 text-[10px]">{localTime}</div>
                      </td>

                      {/* Actor Email & Role */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900">{log.actor_email || 'System / Service'}</div>
                        {log.actor_role && (
                          <Badge
                            variant={log.actor_role === 'admin' ? 'info' : log.actor_role === 'dentist' ? 'success' : 'neutral'}
                            className="text-[10px] uppercase font-mono px-1.5 py-0 mt-0.5"
                          >
                            {log.actor_role}
                          </Badge>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 text-slate-800 border border-slate-200">
                          {log.action}
                        </span>
                      </td>

                      {/* Target Resource */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 capitalize">{log.resource_type}</div>
                        {log.resource_id && (
                          <div className="font-mono text-slate-400 text-[10px] truncate max-w-[120px]" title={log.resource_id}>
                            #{log.resource_id}
                          </div>
                        )}
                      </td>

                      {/* Client IP Address */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-500 text-[11px]">
                        {log.ip_address || '—'}
                      </td>

                      {/* Inspect Button */}
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 p-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectLog(log);
                          }}
                          leftIcon={Eye}
                        >
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination & Footer Bar */}
        {data && data.total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <span>
                Showing <strong className="font-semibold text-slate-900">{((data.page - 1) * data.page_size) + 1}</strong> to{' '}
                <strong className="font-semibold text-slate-900">
                  {Math.min(data.page * data.page_size, data.total)}
                </strong>{' '}
                of <strong className="font-semibold text-slate-900">{data.total}</strong> events
              </span>

              <div className="flex items-center gap-1.5 border-l border-slate-300 pl-3">
                <label htmlFor="audit-page-size" className="text-slate-500">Per page:</label>
                <select
                  id="audit-page-size"
                  value={data.page_size}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                  className="rounded border border-slate-300 bg-white py-0.5 px-1.5 text-xs text-slate-800 font-medium"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-700">
                Page {data.page} of {data.total_pages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(data.page - 1)}
                  disabled={data.page <= 1}
                  className="p-1.5"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(data.page + 1)}
                  disabled={data.page >= data.total_pages}
                  className="p-1.5"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogsTable;
