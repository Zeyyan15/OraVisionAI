/**
 * OraVisionAI — Admin Dentist Verifications Management Page
 *
 * Route: /admin/verifications
 *
 * Implements status-tabbed filtering (Pending, Approved, Rejected, All),
 * synchronized query parameter state, practitioner credential overview,
 * and binding to the interactive review & approval modal.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AdminDentistVerificationResponse,
  AdminVerificationListResponse,
} from '../../types/admin';
import { listDentistVerifications } from '../../api/adminEndpoints';
import { DentistVerificationDetailModal } from '../../components/admin/DentistVerificationDetailModal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import {
  UserCheck,
  RefreshCw,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
} from 'lucide-react';

type StatusTab = 'pending' | 'approved' | 'rejected' | 'all';

export const AdminDentistVerificationsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = (searchParams.get('status') as StatusTab) || 'pending';
  const urlPage = parseInt(searchParams.get('page') || '1', 10);

  const [activeTab, setActiveTab] = useState<StatusTab>(urlStatus);
  const [currentPage, setCurrentPage] = useState<number>(urlPage > 0 ? urlPage : 1);
  const [data, setData] = useState<AdminVerificationListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedVerification, setSelectedVerification] = useState<AdminDentistVerificationResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Synchronize internal state when URL search params change
  useEffect(() => {
    const s = (searchParams.get('status') as StatusTab) || 'pending';
    const p = parseInt(searchParams.get('page') || '1', 10);
    setActiveTab(s);
    setCurrentPage(p > 0 ? p : 1);
  }, [searchParams]);

  const fetchVerifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listDentistVerifications({
        status: activeTab === 'all' ? undefined : activeTab,
        page: currentPage,
        page_size: 20,
      });
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve dentist verifications');
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentPage]);

  useEffect(() => {
    fetchVerifications();
  }, [fetchVerifications]);

  const handleTabChange = (tab: StatusTab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchParams({ status: tab, page: '1' });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && (!data || newPage <= data.total_pages)) {
      setCurrentPage(newPage);
      setSearchParams({ status: activeTab, page: String(newPage) });
    }
  };

  const handleOpenDetail = (verification: AdminDentistVerificationResponse) => {
    setSelectedVerification(verification);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedVerification(null);
  };

  const handleVerificationUpdated = (_updated: AdminDentistVerificationResponse) => {
    // Refresh the list to reflect status changes accurately
    fetchVerifications();
  };

  const tabs: { key: StatusTab; label: string }[] = [
    { key: 'pending', label: 'Pending Review' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All Submissions' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Dentist Verifications
            </h1>
            <Badge variant="info" className="text-xs uppercase font-mono">
              Licensing Oversight
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Review submitted practitioner dental licenses, evaluate credential documentation, and grant clinical workspace authorization.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchVerifications}
          disabled={loading}
          leftIcon={RefreshCw}
          className={loading ? 'animate-spin-icon' : ''}
        >
          {loading ? 'Refreshing...' : 'Refresh List'}
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-clinical-600 text-clinical-800'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
              {tab.key === 'pending' && data && activeTab === 'pending' && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                  {data.total}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      {loading && !data ? (
        <LoadingSkeleton variant="card" count={3} />
      ) : error ? (
        <ErrorState
          title="Failed to Load Verifications"
          message={error}
          onRetry={fetchVerifications}
        />
      ) : data && data.items.length === 0 ? (
        <EmptyState
          title={`No ${activeTab === 'all' ? '' : activeTab} verifications found`}
          description={
            activeTab === 'pending'
              ? 'All registered dentist verification requests have been reviewed.'
              : `There are currently no verification records with status '${activeTab}'.`
          }
          icon={UserCheck}
        />
      ) : data ? (
        <div className="space-y-4">
          {/* Table Container */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th scope="col" className="py-3.5 px-4">Dentist</th>
                    <th scope="col" className="py-3.5 px-4">License & Specialization</th>
                    <th scope="col" className="py-3.5 px-4">Credential Document</th>
                    <th scope="col" className="py-3.5 px-4">Submitted At</th>
                    <th scope="col" className="py-3.5 px-4">Status</th>
                    <th scope="col" className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                  {data.items.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => handleOpenDetail(item)}
                    >
                      {/* Dentist Column */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {item.dentist_name || 'Name Unavailable'}
                        </div>
                        <div className="text-[11px] text-slate-500">{item.dentist_email || 'No email'}</div>
                      </td>

                      {/* License & Specialization Column */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-semibold text-slate-900">
                          {item.license_number || 'N/A'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {item.specialization || 'General Dentistry'}
                        </div>
                      </td>

                      {/* Credential Document Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-slate-800">
                          <FileText className="h-3.5 w-3.5 text-clinical-600 shrink-0" />
                          <span className="font-medium truncate max-w-[180px]" title={item.file_name}>
                            {item.file_name}
                          </span>
                        </div>
                        <div className="text-[10px] uppercase font-mono text-slate-400">
                          {item.document_type}
                        </div>
                      </td>

                      {/* Submitted At Column */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{new Date(item.submitted_at).toLocaleDateString()}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(item.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Status Column */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge
                          variant={
                            item.status === 'approved'
                              ? 'success'
                              : item.status === 'rejected'
                              ? 'danger'
                              : 'warning'
                          }
                          className="capitalize font-semibold"
                        >
                          {item.status}
                        </Badge>
                      </td>

                      {/* Action Column */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={Eye}
                          onClick={() => handleOpenDetail(item)}
                        >
                          {item.status === 'pending' ? 'Review' : 'Inspect'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {data.total_pages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50/50">
                <div className="text-xs text-slate-500">
                  Showing Page <strong className="text-slate-800">{data.page}</strong> of{' '}
                  <strong className="text-slate-800">{data.total_pages}</strong> ({data.total} total verifications)
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={ChevronLeft}
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1 || loading}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    rightIcon={ChevronRight}
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= data.total_pages || loading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Verification Detail & Review Modal */}
      <DentistVerificationDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        verificationId={selectedVerification ? selectedVerification.id : null}
        initialVerification={selectedVerification}
        onVerificationUpdated={handleVerificationUpdated}
      />
    </div>
  );
};

export default AdminDentistVerificationsPage;
