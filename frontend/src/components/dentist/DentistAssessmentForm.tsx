/**
 * OraVisionAI — Dentist Clinical Assessment Form (Phase 24)
 *
 * Provides a structured clinical interface for dental practitioners to record
 * clinical observations, preliminary diagnosis, treatment recommendations,
 * and specialist referrals.
 *
 * Implements draft saving and assessment finalization and locking with
 * confirmation dialog and locked state rendering.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import {
  FileText,
  Lock,
  Save,
  CheckCircle2,
  AlertTriangle,
  Send,
  Stethoscope,
  Building2,
} from 'lucide-react';
import { DentistAssessment } from '../../types/dentist';

export interface DentistAssessmentFormData {
  clinical_observations: string;
  diagnosis_notes: string;
  treatment_recommendation: string;
  referral_needed: boolean;
  referral_specialty?: string | null;
}

export interface DentistAssessmentFormProps {
  assessment: DentistAssessment | null;
  isFinalized: boolean;
  savingDraft: boolean;
  finalizing: boolean;
  assessmentError: string | null;
  onSaveDraft: (data: DentistAssessmentFormData) => Promise<unknown>;
  onFinalize: (data: DentistAssessmentFormData) => Promise<unknown>;
}

export const DentistAssessmentForm: React.FC<DentistAssessmentFormProps> = ({
  assessment,
  isFinalized,
  savingDraft,
  finalizing,
  assessmentError,
  onSaveDraft,
  onFinalize,
}) => {
  const [formData, setFormData] = useState<DentistAssessmentFormData>({
    clinical_observations: '',
    diagnosis_notes: '',
    treatment_recommendation: '',
    referral_needed: false,
    referral_specialty: '',
  });

  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize or update form when assessment changes
  useEffect(() => {
    if (assessment) {
      setFormData({
        clinical_observations: assessment.clinical_observations || '',
        diagnosis_notes: assessment.diagnosis_notes || '',
        treatment_recommendation: assessment.treatment_recommendation || '',
        referral_needed: Boolean(assessment.referral_needed),
        referral_specialty: assessment.referral_specialty || '',
      });
    }
  }, [assessment]);

  const handleChange = (
    field: keyof DentistAssessmentFormData,
    value: string | boolean,
  ) => {
    if (isFinalized) return;
    setValidationError(null);
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validate = (): boolean => {
    if (!formData.clinical_observations.trim()) {
      setValidationError('Clinical observations are required.');
      return false;
    }
    if (!formData.diagnosis_notes.trim()) {
      setValidationError('Preliminary diagnosis notes are required.');
      return false;
    }
    if (!formData.treatment_recommendation.trim()) {
      setValidationError('Treatment recommendations are required.');
      return false;
    }
    if (formData.referral_needed && !formData.referral_specialty?.trim()) {
      setValidationError('Please specify the specialty department or discipline for referral.');
      return false;
    }
    return true;
  };

  const handleSaveDraftClick = async () => {
    if (!validate()) return;
    try {
      await onSaveDraft(formData);
    } catch {
      // Error handled via props
    }
  };

  const handleFinalizeClick = () => {
    if (!validate()) return;
    setConfirmModalOpen(true);
  };

  const handleConfirmFinalize = async () => {
    setConfirmModalOpen(false);
    try {
      await onFinalize(formData);
    } catch {
      // Error handled via props
    }
  };

  return (
    <Card className="border-clinical-200 shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-clinical-600" />
            <div>
              <CardTitle className="text-lg text-slate-900">
                Professional Clinical Assessment
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Authorized dental practitioner evaluation and diagnostic notes
              </CardDescription>
            </div>
          </div>

          <div>
            {isFinalized ? (
              <Badge variant="success" className="flex items-center gap-1.5 px-3 py-1">
                <Lock className="h-3.5 w-3.5" />
                <span>Finalized Clinical Assessment</span>
              </Badge>
            ) : assessment ? (
              <Badge variant="warning" className="flex items-center gap-1.5 px-3 py-1">
                <FileText className="h-3.5 w-3.5" />
                <span>Draft In Progress</span>
              </Badge>
            ) : (
              <Badge variant="neutral" className="flex items-center gap-1.5 px-3 py-1">
                <FileText className="h-3.5 w-3.5" />
                <span>New Assessment</span>
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Error Alerts */}
        {assessmentError && (
          <Alert variant="danger" title="Assessment Notice" icon={AlertTriangle}>
            {assessmentError}
          </Alert>
        )}

        {validationError && (
          <Alert variant="warning" title="Incomplete Information" icon={AlertTriangle}>
            {validationError}
          </Alert>
        )}

        {/* Finalized Banner */}
        {isFinalized && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Assessment Completed & Locked</span>
            </div>
            <p className="text-xs text-emerald-700">
              This clinical assessment has been finalized by{' '}
              <strong>{assessment?.dentist_name || 'Treating Dentist'}</strong>
              {assessment?.dentist_clinic ? ` (${assessment.dentist_clinic})` : ''} and is
              finalized and editing is locked in accordance with clinical protocol.
              {assessment?.finalized_at && (
                <span className="block mt-1 font-mono text-[11px] text-emerald-600">
                  Timestamp: {new Date(assessment.finalized_at).toLocaleString()}
                </span>
              )}
            </p>
          </div>
        )}

        {/* Form Fields */}
        <div className="space-y-4">
          {/* Clinical Observations */}
          <div className="space-y-1.5">
            <label
              htmlFor="clinical_observations"
              className="block text-sm font-semibold text-slate-800"
            >
              Clinical Observations <span className="text-rose-500">*</span>
            </label>
            <p className="text-xs text-slate-500">
              Objective examination of the oral mucosal tissue, lesion margins, erythema, and surface morphology.
            </p>
            <textarea
              id="clinical_observations"
              rows={4}
              disabled={isFinalized}
              value={formData.clinical_observations}
              onChange={(e) => handleChange('clinical_observations', e.target.value)}
              placeholder="Record detailed objective observations of the oral cavity and target lesion site..."
              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none ${
                isFinalized
                  ? 'bg-slate-50 text-slate-700 border-slate-200 cursor-not-allowed'
                  : 'bg-white border-slate-300 focus:border-clinical-500 focus:ring-1 focus:ring-clinical-500'
              }`}
            />
          </div>

          {/* Preliminary Diagnosis Notes */}
          <div className="space-y-1.5">
            <label
              htmlFor="diagnosis_notes"
              className="block text-sm font-semibold text-slate-800"
            >
              Preliminary Clinical Diagnosis <span className="text-rose-500">*</span>
            </label>
            <p className="text-xs text-slate-500">
              Professional diagnostic synthesis, differential considerations, and clinical staging.
            </p>
            <textarea
              id="diagnosis_notes"
              rows={3}
              disabled={isFinalized}
              value={formData.diagnosis_notes}
              onChange={(e) => handleChange('diagnosis_notes', e.target.value)}
              placeholder="State diagnostic conclusions, differential impressions, and clinical classification..."
              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none ${
                isFinalized
                  ? 'bg-slate-50 text-slate-700 border-slate-200 cursor-not-allowed'
                  : 'bg-white border-slate-300 focus:border-clinical-500 focus:ring-1 focus:ring-clinical-500'
              }`}
            />
          </div>

          {/* Treatment Recommendations */}
          <div className="space-y-1.5">
            <label
              htmlFor="treatment_recommendation"
              className="block text-sm font-semibold text-slate-800"
            >
              Treatment Recommendations <span className="text-rose-500">*</span>
            </label>
            <p className="text-xs text-slate-500">
              Recommended patient interventions, biopsy/histopathology follow-up, and monitoring intervals.
            </p>
            <textarea
              id="treatment_recommendation"
              rows={3}
              disabled={isFinalized}
              value={formData.treatment_recommendation}
              onChange={(e) => handleChange('treatment_recommendation', e.target.value)}
              placeholder="Outline follow-up protocol, biopsies, supportive clinical care, or lifestyle adjustments..."
              className={`w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none ${
                isFinalized
                  ? 'bg-slate-50 text-slate-700 border-slate-200 cursor-not-allowed'
                  : 'bg-white border-slate-300 focus:border-clinical-500 focus:ring-1 focus:ring-clinical-500'
              }`}
            />
          </div>

          {/* Referral Checkbox & Specialty */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <input
                id="referral_needed"
                type="checkbox"
                disabled={isFinalized}
                checked={formData.referral_needed}
                onChange={(e) => handleChange('referral_needed', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-clinical-600 focus:ring-clinical-500 disabled:cursor-not-allowed"
              />
              <label
                htmlFor="referral_needed"
                className="text-sm font-medium text-slate-900 cursor-pointer select-none"
              >
                Specialist Referral Indicated
              </label>
            </div>

            {formData.referral_needed && (
              <div className="pt-2 pl-7 space-y-1.5">
                <label
                  htmlFor="referral_specialty"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Referral Specialty / Department <span className="text-rose-500">*</span>
                </label>
                <Input
                  id="referral_specialty"
                  type="text"
                  disabled={isFinalized}
                  value={formData.referral_specialty || ''}
                  onChange={(e) => handleChange('referral_specialty', e.target.value)}
                  placeholder="e.g. Oral & Maxillofacial Surgery, Oral Pathology, Periodontics"
                  className="max-w-md"
                />
              </div>
            )}
          </div>
        </div>

        {/* Practitioner Attribution Info */}
        {assessment?.dentist_name && (
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span className="flex items-center gap-1.5">
              <Stethoscope className="h-3.5 w-3.5 text-clinical-600" />
              Treating Dentist: <strong>{assessment.dentist_name}</strong>
            </span>
            {assessment.dentist_clinic && (
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                Clinic: {assessment.dentist_clinic}
              </span>
            )}
            {assessment.created_at && (
              <span>Created: {new Date(assessment.created_at).toLocaleDateString()}</span>
            )}
          </div>
        )}
      </CardContent>

      {/* Form Action Controls */}
      {!isFinalized && (
        <CardFooter className="border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 p-4">
          <p className="text-xs text-slate-500">
            Draft assessments remain editable until explicitly finalized.
          </p>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraftClick}
              disabled={savingDraft || finalizing}
              className="flex-1 sm:flex-initial flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              <span>{savingDraft ? 'Saving Draft...' : 'Save Draft'}</span>
            </Button>

            <Button
              type="button"
              variant="primary"
              onClick={handleFinalizeClick}
              disabled={savingDraft || finalizing}
              className="flex-1 sm:flex-initial flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              <span>{finalizing ? 'Finalizing...' : 'Finalize Assessment'}</span>
            </Button>
          </div>
        </CardFooter>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Confirm Clinical Finalization"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3.5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 leading-relaxed">
              Finalizing this clinical assessment makes it immutable and it can no longer be edited through this system. Do you wish to proceed?
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Once confirmed, this assessment will be locked as the definitive clinical evaluation and included in subsequent generated patient reports.
          </p>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmModalOpen(false)}
              disabled={finalizing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleConfirmFinalize}
              disabled={finalizing}
              className="flex items-center gap-2"
            >
              <Lock className="h-4 w-4" />
              <span>{finalizing ? 'Finalizing...' : 'Confirm Finalization'}</span>
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};

export default DentistAssessmentForm;
