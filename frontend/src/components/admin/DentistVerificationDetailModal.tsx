/**
 * OraVisionAI — Dentist Verification Detail & Review Modal
 *
 * Provides administrative inspection of practitioner identity, license number,
 * specialization, and submitted credential document. Enables Approve/Reject
 * decision submission with optional review notes.
 */

import React, { useState, useEffect } from 'react';
import {
  AdminDentistVerificationResponse,
  VerificationReviewRequest,
} from '../../types/admin';
import {
  getDentistVerificationDetail,
  approveDentistVerification,
  rejectDentistVerification,
} from '../../api/adminEndpoints';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { LoadingSkeleton } from '../feedback/LoadingSkeleton';
import {
  User,
  Mail,
  FileText,
  ExternalLink,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';

export interface DentistVerificationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  verificationId: string | null;
  initialVerification?: AdminDentistVerificationResponse | null;
  onVerificationUpdated?: (updated: AdminDentistVerificationResponse) => void;
}

export const DentistVerificationDetailModal: React.FC<DentistVerificationDetailModalProps> = ({
  isOpen,
  onClose,
  verificationId,
  initialVerification,
  onVerificationUpdated,
}) => {
  const [verification, setVerification] = useState<AdminDentistVerificationResponse | null>(
    initialVerification || null
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !verificationId) return;

    if (initialVerification && initialVerification.id === verificationId) {
      setVerification(initialVerification);
      setReviewNotes(initialVerification.review_notes || '');
      setActionError(null);
      setActionSuccess(null);
      return;
    }

    let isMounted = true;
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      setActionError(null);
      setActionSuccess(null);
      try {
        const res = await getDentistVerificationDetail(verificationId);
        if (isMounted) {
          setVerification(res);
          setReviewNotes(res.review_notes || '');
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to retrieve verification details');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [isOpen, verificationId, initialVerification]);

  const handleApprove = async () => {
    if (!verificationId) return;
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    const payload: VerificationReviewRequest = {
      review_notes: reviewNotes.trim() ? reviewNotes.trim() : undefined,
    };

    try {
      const updated = await approveDentistVerification(verificationId, payload);
      setVerification(updated);
      setActionSuccess('Dentist verification approved successfully.');
      if (onVerificationUpdated) {
        onVerificationUpdated(updated);
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve verification.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!verificationId) return;
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    const payload: VerificationReviewRequest = {
      review_notes: reviewNotes.trim() ? reviewNotes.trim() : undefined,
    };

    try {
      const updated = await rejectDentistVerification(verificationId, payload);
      setVerification(updated);
      setActionSuccess('Dentist verification rejected.');
      if (onVerificationUpdated) {
        onVerificationUpdated(updated);
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to reject verification.');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  const isPending = verification?.status === 'pending';

  const formatBytes = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return 'Unknown size';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Dentist Verification Review" maxWidth="lg">
      <div className="space-y-5">
        {loading ? (
          <div className="p-4">
            <LoadingSkeleton variant="card" count={2} />
          </div>
        ) : error ? (
          <Alert variant="danger" className="mb-4">
            {error}
          </Alert>
        ) : verification ? (
          <div className="space-y-4 text-xs">
            {/* Action Feedback Alerts */}
            {actionSuccess && (
              <Alert variant="success" className="text-xs" onClose={() => setActionSuccess(null)}>
                {actionSuccess}
              </Alert>
            )}
            {actionError && (
              <Alert variant="danger" className="text-xs" onClose={() => setActionError(null)}>
                {actionError}
              </Alert>
            )}

            {/* Practitioner & Status Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-clinical-100 text-clinical-700">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    {verification.dentist_name || 'Practitioner Name Unavailable'}
                  </h4>
                  <p className="text-slate-500 flex items-center gap-1 text-[11px] mt-0.5">
                    <Mail className="h-3 w-3" />
                    <span>{verification.dentist_email || 'No email registered'}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    verification.status === 'approved'
                      ? 'success'
                      : verification.status === 'rejected'
                      ? 'danger'
                      : 'warning'
                  }
                  className="capitalize font-semibold text-xs px-2.5 py-1"
                >
                  {verification.status}
                </Badge>
              </div>
            </div>

            {/* Credential Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* License Number */}
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium">Dental License Number</span>
                <p className="font-mono text-sm font-bold text-slate-900 mt-0.5">
                  {verification.license_number || 'Not provided'}
                </p>
              </div>

              {/* Specialization */}
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium">Specialization</span>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">
                  {verification.specialization || 'General Dentistry'}
                </p>
              </div>

              {/* Submission Date */}
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Submitted At
                </span>
                <p className="text-xs font-medium text-slate-800 mt-0.5">
                  {new Date(verification.submitted_at).toLocaleString()}
                </p>
              </div>

              {/* Reviewed Timestamp if present */}
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Reviewed At
                </span>
                <p className="text-xs font-medium text-slate-800 mt-0.5">
                  {verification.reviewed_at
                    ? new Date(verification.reviewed_at).toLocaleString()
                    : 'Awaiting administrative review'}
                </p>
              </div>
            </div>

            {/* Submitted Credential Document Card */}
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                Submitted License Document
              </span>
              <div className="flex items-center justify-between gap-3 bg-white p-3 rounded border border-slate-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="h-6 w-6 text-clinical-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {verification.file_name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Type: <span className="uppercase font-mono">{verification.document_type}</span> • {formatBytes(verification.file_size_bytes)}
                    </p>
                  </div>
                </div>

                {verification.document_url && (
                  <a
                    href={verification.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-clinical-50 text-clinical-700 hover:bg-clinical-100 font-semibold text-xs transition-colors shrink-0"
                  >
                    <span>View Document</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* Review Notes Section */}
            {isPending ? (
              <div className="space-y-1.5">
                <label htmlFor="review-notes" className="block text-xs font-semibold text-slate-700">
                  Administrative Review Notes (Optional)
                </label>
                <textarea
                  id="review-notes"
                  rows={3}
                  maxLength={1000}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Provide clinical notes or reasons for approval / rejection (max 1000 chars)..."
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-clinical-500 focus:outline-none focus:ring-1 focus:ring-clinical-500"
                  disabled={actionLoading}
                />
                <p className="text-[10px] text-slate-400 text-right">
                  {reviewNotes.length} / 1000 characters
                </p>
              </div>
            ) : verification.review_notes ? (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                  Review Notes
                </span>
                <p className="text-xs text-slate-800 mt-1 whitespace-pre-wrap">
                  {verification.review_notes}
                </p>
              </div>
            ) : null}

            {/* Actions for Pending Requests */}
            {isPending && (
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={actionLoading}
                >
                  Cancel
                </Button>

                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={XCircle}
                  onClick={handleReject}
                  loading={actionLoading}
                >
                  Reject Verification
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={CheckCircle}
                  onClick={handleApprove}
                  loading={actionLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Approve Verification
                </Button>
              </div>
            )}

            {!isPending && (
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end">
                <Button variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default DentistVerificationDetailModal;
