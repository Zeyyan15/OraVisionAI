/**
 * OraVisionAI — Dentist Professional Credential Verification Card (Phase 24)
 *
 * Displays practitioner verification status and metadata submission interface
 * strictly honoring the backend contract: POST /api/dentists/me/verification.
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { Input } from '../ui/Input';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  Send,
  FileCheck,
  FileText,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { DentistProfile, DentistVerification, DentistVerificationCreate } from '../../types/dentist';

export interface DentistVerificationCardProps {
  profile: DentistProfile | null;
  verification: DentistVerification | null;
  submitting: boolean;
  onSubmit: (data: DentistVerificationCreate) => Promise<unknown>;
}

export const DentistVerificationCard: React.FC<DentistVerificationCardProps> = ({
  profile,
  verification,
  submitting,
  onSubmit,
}) => {
  const [documentType, setDocumentType] = useState<string>('State Dental Board License');
  const [documentUrl, setDocumentUrl] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const status = profile?.verification_status || 'pending';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);

    if (!documentType.trim()) {
      setFormError('Document type is required.');
      return;
    }
    if (!documentUrl.trim()) {
      setFormError('Document reference URL is required.');
      return;
    }
    if (!fileName.trim()) {
      setFormError('File name or document identifier is required.');
      return;
    }

    try {
      await onSubmit({
        document_type: documentType.trim(),
        document_url: documentUrl.trim(),
        file_name: fileName.trim(),
      });
      setSuccessMsg('Credential verification metadata submitted successfully.');
      setDocumentUrl('');
      setFileName('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit verification metadata';
      setFormError(msg);
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-clinical-600" />
            <div>
              <CardTitle className="text-base text-slate-900">
                Professional Credential Verification
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Administrative verification status and credential documentation
              </CardDescription>
            </div>
          </div>

          <div>
            {status === 'approved' && (
              <Badge variant="success" className="flex items-center gap-1.5 px-3 py-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Approved Dentist</span>
              </Badge>
            )}
            {status === 'pending' && (
              <Badge variant="warning" className="flex items-center gap-1.5 px-3 py-1">
                <Clock className="h-3.5 w-3.5" />
                <span>Pending Verification</span>
              </Badge>
            )}
            {status === 'rejected' && (
              <Badge variant="danger" className="flex items-center gap-1.5 px-3 py-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Verification Rejected</span>
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Status Messages */}
        {status === 'approved' && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <FileCheck className="h-4 w-4 text-emerald-600" />
              <span>Practitioner Credentials Approved</span>
            </div>
            <p className="text-xs text-emerald-700">
              Your professional credentials have been verified by the clinical administrator. Full access to clinical evaluations, draft finalization, and telehealth consultations is enabled.
            </p>
            {profile?.verified_at && (
              <p className="text-[11px] text-emerald-600 font-mono mt-1">
                Verified: {new Date(profile.verified_at).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {status === 'pending' && (
          <Alert variant="warning" title="Verification Under Review" icon={Clock}>
            Your practitioner account is awaiting administrative credential verification. You may draft clinical assessments; full authorization to conduct video telehealth sessions will activate once an administrator verifies your submission.
          </Alert>
        )}

        {status === 'rejected' && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-4 w-4 text-rose-600" />
              <span>Verification Document Rejected</span>
            </div>
            <p className="text-xs text-rose-700">
              The submitted credential documentation could not be verified. Please review the reviewer's notes below and submit updated credential metadata.
            </p>
            {profile?.rejection_reason && (
              <div className="rounded bg-white/70 p-2.5 text-xs text-rose-900 border border-rose-100">
                <strong>Reason:</strong> {profile.rejection_reason}
              </div>
            )}
          </div>
        )}

        {/* Existing Verification Record if available */}
        {verification && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
            <h5 className="font-semibold text-slate-800 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-slate-500" />
              <span>Latest Submitted Verification Record</span>
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 pt-1">
              <div>
                <span className="font-medium text-slate-500">Document Type:</span>{' '}
                {verification.document_type}
              </div>
              <div>
                <span className="font-medium text-slate-500">File Identifier:</span>{' '}
                {verification.file_name}
              </div>
              <div className="col-span-full">
                <span className="font-medium text-slate-500">Reference URL:</span>{' '}
                <a
                  href={verification.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-clinical-600 hover:underline inline-flex items-center gap-1"
                >
                  <span className="truncate max-w-sm">{verification.document_url}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div>
                <span className="font-medium text-slate-500">Submitted:</span>{' '}
                {new Date(verification.submitted_at).toLocaleDateString()}
              </div>
              {verification.review_notes && (
                <div className="col-span-full">
                  <span className="font-medium text-slate-500">Review Notes:</span>{' '}
                  {verification.review_notes}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submission Form (available for pending or rejected accounts) */}
        {status !== 'approved' && (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-slate-100">
            <h4 className="text-sm font-semibold text-slate-900">
              Submit Credential Verification Metadata
            </h4>

            {formError && (
              <Alert variant="danger" title="Submission Error" icon={AlertCircle}>
                {formError}
              </Alert>
            )}

            {successMsg && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-medium">
                {successMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label
                  htmlFor="document_type"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Document Type <span className="text-rose-500">*</span>
                </label>
                <select
                  id="document_type"
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-clinical-500 focus:outline-none"
                >
                  <option value="State Dental Board License">State Dental Board License</option>
                  <option value="Dental Council Registration">Dental Council Registration</option>
                  <option value="Specialist Board Certification">Specialist Board Certification</option>
                  <option value="Professional Indemnity Certificate">
                    Professional Indemnity Certificate
                  </option>
                  <option value="Hospital Privileges Credential">Hospital Privileges Credential</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="file_name" className="block text-xs font-semibold text-slate-700">
                  File Name / Identifier <span className="text-rose-500">*</span>
                </label>
                <Input
                  id="file_name"
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="e.g. dental_board_cert_2026.pdf"
                />
              </div>

              <div className="col-span-full space-y-1">
                <label
                  htmlFor="document_url"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Credential Reference URL <span className="text-rose-500">*</span>
                </label>
                <Input
                  id="document_url"
                  type="url"
                  value={documentUrl}
                  onChange={(e) => setDocumentUrl(e.target.value)}
                  placeholder="https://verify.dentalboard.org/license/12345"
                />
                <p className="text-[11px] text-slate-400">
                  Provide an authorized verification URL or secure credential registry reference for administrative review.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
                className="text-xs flex items-center gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{submitting ? 'Submitting...' : 'Submit Credentials for Review'}</span>
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

export default DentistVerificationCard;
