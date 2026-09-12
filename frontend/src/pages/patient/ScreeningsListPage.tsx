/**
 * OraVisionAI - Patient Screening History List Page (Phase 23)
 *
 * Paginated screening history with status filtering and navigation to detailed findings.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPatientScreenings } from '../../api/screeningEndpoints';
import { ScreeningResponse } from '../../types/screening';
import type { ScreeningStatus } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { EmptyState } from '../../components/feedback/EmptyState';
import { ErrorState } from '../../components/feedback/ErrorState';
import {
  Plus,
  Calendar,
  ChevronRight,
  Filter,
  RefreshCw,
  ChevronLeft,
} from 'lucide-react';

export const ScreeningsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [screenings, setScreenings] = useState<ScreeningResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPatientScreenings(page, pageSize);
      setScreenings(data.items || []);
      setTotal(data.total || 0);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load screening history.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const filteredScreenings = screenings.filter((s) => {
    if (statusFilter === 'all') return true;
    return s.status === statusFilter;
  });

  const totalPages = Math.ceil(total / pageSize) || 1;

  const getStatusBadgeVariant = (status: ScreeningStatus) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'processing':
        return 'warning';
      case 'failed':
        return 'danger';
      case 'uploading':
        return 'warning';
      default:
        return 'neutral';
    }
  };

  return (
    <div className='space-y-6 max-w-6xl mx-auto'>
      {/* Top Header */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight text-slate-900'>
            My Oral Screenings
          </h1>
          <p className='text-sm text-slate-500'>
            Historical archive of AI-assisted screenings, feature attributions, and clinical reports.
          </p>
        </div>

        <div className='flex items-center gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={fetchList}
            disabled={loading}
            className='shrink-0'
          >
            <RefreshCw className={'h-3.5 w-3.5 mr-1.5 ' + (loading ? 'animate-spin' : '')} />
            Refresh
          </Button>

          <Button
            type='button'
            variant='primary'
            onClick={() => navigate('/patient/screenings/new')}
            className='shrink-0'
          >
            <Plus className='h-4 w-4 mr-1.5' />
            Start New Screening
          </Button>
        </div>
      </div>

      {/* Filter & Summary Bar */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-xs'>
        <div className='flex items-center gap-2 text-xs text-slate-600'>
          <Filter className='h-4 w-4 text-slate-400' />
          <span className='font-semibold'>Filter Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className='rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 bg-white focus:border-clinical-500 focus:outline-none'
          >
            <option value='all'>All Statuses ({total})</option>
            <option value='completed'>Completed</option>
            <option value='processing'>Processing</option>
            <option value='uploading'>Uploading</option>
            <option value='pending'>Pending</option>
            <option value='failed'>Failed</option>
          </select>
        </div>

        <div className='text-xs text-slate-500'>
          Showing <span className='font-medium text-slate-800'>{filteredScreenings.length}</span> of{' '}
          <span className='font-medium text-slate-800'>{total}</span> total sessions
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className='space-y-3'>
          <LoadingSkeleton variant='table' count={4} />
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <ErrorState
          title='Failed to Load Screenings'
          message={error}
          onRetry={fetchList}
        />
      )}

      {/* Empty State */}
      {!loading && !error && filteredScreenings.length === 0 && (
        <EmptyState
          title='No Screenings Found'
          description={
            statusFilter === 'all'
              ? 'You have not initiated any oral cavity screenings yet. Create your first screening session to receive automated deep learning decision-support.'
              : 'No screenings match the selected status filter.'
          }
          actionLabel='Start New Screening'
          onAction={() => navigate('/patient/screenings/new')}
        />
      )}

      {/* Screenings List Cards */}
      {!loading && !error && filteredScreenings.length > 0 && (
        <div className='space-y-3'>
          {filteredScreenings.map((screening) => (
            <div
              key={screening.id}
              onClick={() => navigate('/patient/screenings/' + screening.id)}
              className='group rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs hover:border-clinical-300 hover:shadow-sm transition-all cursor-pointer'
            >
              <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
                <div className='space-y-1.5 flex-1 min-w-0'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='text-sm font-bold text-slate-900 group-hover:text-clinical-700 transition-colors'>
                      Oral Screening Session
                    </span>
                    <Badge variant={getStatusBadgeVariant(screening.status)}>
                      {screening.status.toUpperCase()}
                    </Badge>
                  </div>

                  <p className='text-xs text-slate-600 line-clamp-1'>
                    {screening.clinical_notes || (
                      <span className='italic text-slate-400'>No clinical symptoms noted.</span>
                    )}
                  </p>

                  <div className='flex items-center gap-3 text-[11px] text-slate-400 pt-0.5'>
                    <span className='flex items-center gap-1'>
                      <Calendar className='h-3 w-3' />
                      {new Date(screening.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className='flex items-center gap-2 shrink-0 self-end sm:self-center'>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    className='text-xs group-hover:border-clinical-400 group-hover:text-clinical-700'
                  >
                    View Results
                    <ChevronRight className='h-3.5 w-3.5 ml-1 group-hover:translate-x-0.5 transition-transform' />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className='flex items-center justify-between pt-4 border-t border-slate-200 text-xs text-slate-500'>
              <span>
                Page {page} of {totalPages}
              </span>
              <div className='flex items-center gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page <= 1 || loading}
                >
                  <ChevronLeft className='h-3.5 w-3.5 mr-1' />
                  Previous
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page >= totalPages || loading}
                >
                  Next
                  <ChevronRight className='h-3.5 w-3.5 ml-1' />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScreeningsListPage;
