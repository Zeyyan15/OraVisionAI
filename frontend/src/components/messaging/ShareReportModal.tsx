/**
 * OraVisionAI — Share Report Modal (Phase 34)
 *
 * Allows a dentist to pick an authorized clinical report for the active patient
 * in the conversation, attach an optional clinical note, and share it as an immutable reference.
 */

import React, { useEffect, useState } from 'react';
import { FileText, Share2, AlertCircle, Loader2, Calendar } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { getShareableReports, shareReport } from '../../api/communicationEndpoints';
import { MessageResponse, ShareableReportItem } from '../../types/communication';

export interface ShareReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  onReportShared: (msg: MessageResponse) => void;
}

export const ShareReportModal: React.FC<ShareReportModalProps> = ({
  isOpen,
  onClose,
  conversationId,
  onReportShared,
}) => {
  const [reports, setReports] = useState<ShareableReportItem[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !conversationId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setSelectedReportId(null);
    setNote('');

    getShareableReports(conversationId)
      .then((items) => {
        if (!isMounted) return;
        setReports(items || []);
        if (items && items.length > 0) {
          setSelectedReportId(items[0].id);
        }
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to load shareable reports';
        setError(msg);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, conversationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReportId || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const msg = await shareReport(conversationId, {
        report_id: selectedReportId,
        note: note.trim() || undefined,
      });
      onReportShared(msg);
      onClose();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Failed to share clinical report';
      setError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Clinical Report" maxWidth="lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Select Patient Report to Share
          </label>

          {loading ? (
            <div className="flex items-center justify-center p-8 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-xs">Loading available reports...</span>
            </div>
          ) : reports.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
              <FileText className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-xs font-semibold text-slate-700">No reports found</p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                There are no finalized clinical reports available for this patient yet.
              </p>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {reports.map((r) => {
                const isSelected = selectedReportId === r.id;
                return (
                  <label
                    key={r.id}
                    onClick={() => setSelectedReportId(r.id)}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-clinical-500 bg-clinical-50/40 ring-1 ring-clinical-500'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="selected_report"
                      value={r.id}
                      checked={isSelected}
                      onChange={() => setSelectedReportId(r.id)}
                      className="mt-1 text-clinical-600 focus:ring-clinical-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {r.report_number}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 flex-shrink-0">
                          <Calendar className="h-3 w-3" />
                          {formatDate(r.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{r.report_title}</p>
                      {r.summary && (
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                          {r.summary}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Clinical Note to Patient */}
        <div>
          <label htmlFor="report-note" className="block text-xs font-semibold text-slate-700 mb-1.5">
            Clinical Note for Patient (Optional)
          </label>
          <textarea
            id="report-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={submitting || reports.length === 0}
            maxLength={1000}
            placeholder="e.g., Please review your recent screening summary before our scheduled consultation."
            className="w-full rounded-xl border border-slate-200 p-2.5 text-xs placeholder:text-slate-400 focus:border-clinical-500 focus:outline-none focus:ring-1 focus:ring-clinical-500 disabled:bg-slate-50 resize-none"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!selectedReportId || submitting || reports.length === 0}
            className="flex items-center gap-1.5"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Sharing...</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                <span>Share Report</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

