/**
 * OraVisionAI - Dentist Clinical Review Card Component (Phase 23)
 *
 * READ-ONLY in Phase 23 (Patient View).
 * Displays authorized evaluations submitted by licensed treating dentists.
 * Strict separation: Licensed dentist clinical evaluations are separate from AI predictions.
 */

import React, { useState } from 'react';
import { DentistAssessmentSummary } from '../../types/screening';
import { Stethoscope, AlertCircle, Clock, ShieldCheck, UserPlus, CheckCircle2 } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { listApprovedDentists } from '../../api/dentistEndpoints';
import { requestScreeningReview } from '../../api/screeningEndpoints';
import { DentistProfile } from '../../types/dentist';

export interface DentistReviewCardProps {
  dentistAssessments: DentistAssessmentSummary[];
  screeningId?: string;
  onRequestReviewSuccess?: () => void;
}

export const DentistReviewCard: React.FC<DentistReviewCardProps> = ({
  dentistAssessments,
  screeningId,
  onRequestReviewSuccess,
}) => {
  const hasAssessments = dentistAssessments && dentistAssessments.length > 0;
  const hasFinalized = hasAssessments && dentistAssessments.some((a) => a.is_finalized);
  const hasPendingDraft = hasAssessments && dentistAssessments.some((a) => !a.is_finalized);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dentists, setDentists] = useState<DentistProfile[]>([]);
  const [loadingDentists, setLoadingDentists] = useState(false);
  const [selectedDentistId, setSelectedDentistId] = useState('');
  const [patientNotes, setPatientNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleOpenModal = async () => {
    setIsModalOpen(true);
    setSubmitSuccess(false);
    setSubmitError(null);
    setLoadingDentists(true);
    try {
      const list = await listApprovedDentists();
      setDentists(list);
      if (list.length > 0 && !selectedDentistId) {
        setSelectedDentistId(list[0].id);
      }
    } catch {
      setSubmitError('Unable to load directory of approved dental practitioners.');
    } finally {
      setLoadingDentists(false);
    }
  };

  const handleRequestReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!screeningId || !selectedDentistId || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      await requestScreeningReview(screeningId, selectedDentistId, patientNotes.trim() || undefined);
      setSubmitSuccess(true);
      if (onRequestReviewSuccess) {
        onRequestReviewSuccess();
      }
      setTimeout(() => {
        setIsModalOpen(false);
        setSubmitSuccess(false);
        setPatientNotes('');
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit review request.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className='rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4'>
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100'>
        <div className='flex items-center gap-2'>
          <Stethoscope className='h-5 w-5 text-clinical-600' />
          <div>
            <h3 className='text-base font-semibold text-slate-900'>
              Dentist Clinical Assessment
            </h3>
            <p className='text-xs text-slate-500'>
              Authored by a licensed dental practitioner (distinct from AI screening results).
            </p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          {hasFinalized ? (
            <Badge variant='success'>Clinically Reviewed</Badge>
          ) : hasPendingDraft ? (
            <Badge variant='warning'>Review in Progress</Badge>
          ) : (
            <Badge variant='neutral'>Awaiting Review</Badge>
          )}

          {screeningId && (
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={handleOpenModal}
              className='text-xs flex items-center gap-1.5 ml-2'
            >
              <UserPlus className='h-3.5 w-3.5 text-clinical-600' />
              <span>{hasAssessments ? 'Request Second Opinion' : 'Request Dentist Review'}</span>
            </Button>
          )}
        </div>
      </div>

      {hasAssessments ? (
        <div className='space-y-4'>
          {dentistAssessments.map((assessment, idx) => (
            <div
              key={assessment.id || idx}
              className='rounded-xl border border-clinical-100 bg-clinical-50/20 p-4 space-y-3'
            >
              {/* Dentist Header */}
              <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-clinical-100/60'>
                <div className='flex items-center gap-2'>
                  <ShieldCheck className='h-4 w-4 text-clinical-600' />
                  <span className='text-xs font-bold text-slate-900'>
                    {assessment.dentist_name || 'Licensed Dental Practitioner'}
                  </span>
                  {assessment.dentist_clinic && (
                    <span className='text-xs text-slate-500'>- {assessment.dentist_clinic}</span>
                  )}
                </div>
                <div className='flex items-center gap-2 text-[11px] text-slate-500'>
                  {assessment.is_finalized ? (
                    <Badge variant='success' className='text-[10px]'>Finalized</Badge>
                  ) : (
                    <Badge variant='warning' className='text-[10px]'>Draft Review</Badge>
                  )}
                  {assessment.finalized_at && (
                    <span>{new Date(assessment.finalized_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              {/* Clinical Observations */}
              <div className='space-y-1 text-xs'>
                <span className='font-semibold text-slate-700 block'>Clinical Observations:</span>
                <p className='text-slate-800 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100'>
                  {assessment.clinical_observations}
                </p>
              </div>

              {/* Diagnosis Notes */}
              <div className='space-y-1 text-xs'>
                <span className='font-semibold text-slate-700 block'>Professional Diagnosis / Evaluation:</span>
                <p className='text-slate-800 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100'>
                  {assessment.diagnosis_notes}
                </p>
              </div>

              {/* Treatment Recommendation */}
              <div className='space-y-1 text-xs'>
                <span className='font-semibold text-slate-700 block'>Treatment Recommendation:</span>
                <p className='text-slate-800 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100'>
                  {assessment.treatment_recommendation}
                </p>
              </div>

              {/* Referral Information */}
              {assessment.referral_needed && (
                <div className='rounded-lg border border-rose-200 bg-rose-50/60 p-2.5 flex items-start gap-2 text-xs text-rose-900'>
                  <AlertCircle className='h-4 w-4 text-rose-600 shrink-0 mt-0.5' />
                  <div>
                    <span className='font-bold'>Specialist Referral Recommended:</span>{' '}
                    <span>{assessment.referral_specialty || 'Oral Pathology / Maxillofacial Specialist'}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className='rounded-lg border border-dashed border-slate-200 p-6 text-center text-slate-500 space-y-3'>
          <Clock className='h-8 w-8 text-slate-300 mx-auto' />
          <h4 className='text-sm font-semibold text-slate-700'>No Dentist Review Submitted Yet</h4>
          <p className='text-xs text-slate-500 max-w-md mx-auto leading-relaxed'>
            A licensed dental practitioner has not yet submitted an in-person or remote clinical evaluation for this
            screening session. Once reviewed, clinical notes, diagnosis, and treatment recommendations will appear here.
            You can request a clinical review from an approved dentist.
          </p>
          {screeningId && (
            <Button
              type='button'
              size='sm'
              variant='primary'
              onClick={handleOpenModal}
              className='text-xs inline-flex items-center gap-1.5 mt-2'
            >
              <UserPlus className='h-3.5 w-3.5' />
              <span>Request Clinical Review</span>
            </Button>
          )}
        </div>
      )}

      {/* Request Review Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !submitting && setIsModalOpen(false)}
        title="Request Dentist Clinical Review"
        maxWidth="md"
      >
        <form onSubmit={handleRequestReview} className="space-y-4">
          <p className="text-xs text-slate-600">
            Select an approved dental practitioner to review this screening session. The dentist will evaluate your AI findings and provide professional clinical notes.
          </p>

          {submitError && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {submitSuccess && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Review request successfully sent! The practitioner has been notified.</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Approved Dentist
            </label>
            {loadingDentists ? (
              <div className="h-10 rounded-lg bg-slate-100 animate-pulse" />
            ) : dentists.length > 0 ? (
              <select
                value={selectedDentistId}
                onChange={(e) => setSelectedDentistId(e.target.value)}
                disabled={submitting || submitSuccess}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-clinical-500 focus:outline-none focus:ring-1 focus:ring-clinical-500 bg-white"
              >
                {dentists.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.first_name} {d.last_name} ({d.clinic_name || d.specialization || 'General Dentistry'})
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-xs text-slate-500">No approved dentists available at this time.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Notes for Practitioner (Optional)
            </label>
            <textarea
              rows={3}
              value={patientNotes}
              onChange={(e) => setPatientNotes(e.target.value)}
              disabled={submitting || submitSuccess}
              placeholder="Describe any symptoms, duration, pain levels, or specific concerns..."
              className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-clinical-500 focus:outline-none focus:ring-1 focus:ring-clinical-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={submitting || submitSuccess || !selectedDentistId}
              className="flex items-center gap-1.5"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>{submitting ? 'Submitting...' : 'Send Request'}</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default DentistReviewCard;
