/**
 * OraVisionAI - Dentist Clinical Review Card Component (Phase 23)
 *
 * READ-ONLY in Phase 23 (Patient View).
 * Displays authorized evaluations submitted by licensed treating dentists.
 * Strict separation: Licensed dentist clinical evaluations are separate from AI predictions.
 */

import React from 'react';
import { DentistAssessmentSummary } from '../../types/screening';
import { Stethoscope, AlertCircle, Clock, ShieldCheck } from 'lucide-react';
import { Badge } from '../ui/Badge';

export interface DentistReviewCardProps {
  dentistAssessments: DentistAssessmentSummary[];
}

export const DentistReviewCard: React.FC<DentistReviewCardProps> = ({
  dentistAssessments,
}) => {
  const hasAssessments = dentistAssessments && dentistAssessments.length > 0;

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
        <Badge variant={hasAssessments ? 'success' : 'neutral'}>
          {hasAssessments ? 'Clinically Reviewed' : 'Awaiting Dentist Review'}
        </Badge>
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
        <div className='rounded-lg border border-dashed border-slate-200 p-6 text-center text-slate-500 space-y-2'>
          <Clock className='h-8 w-8 text-slate-300 mx-auto' />
          <h4 className='text-sm font-semibold text-slate-700'>No Dentist Review Submitted Yet</h4>
          <p className='text-xs text-slate-500 max-w-md mx-auto leading-relaxed'>
            A licensed dental practitioner has not yet submitted an in-person or remote clinical evaluation for this
            screening session. Once reviewed, clinical notes, diagnosis, and treatment recommendations will appear here.
          </p>
        </div>
      )}
    </div>
  );
};

export default DentistReviewCard;
