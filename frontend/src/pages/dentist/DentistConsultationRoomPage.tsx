/**
 * OraVisionAI — Dentist Teleconsultation Workspace Page (Phase 25)
 *
 * Clinical consultation room for approved treating dentists:
 * - Direct lifecycle control: Start Consultation (scheduled -> active), Conclude (active -> ended)
 * - In-consultation clinical summary documentation
 * - Side-by-side diagnostic telemetry (oral photos, YOLO boxes, 7-class AI scores, risk tier)
 * - Hardware readiness testing modal
 * - Synchronizes appointment status per frozen backend rules
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useConsultation } from '../../hooks/useConsultation';
import { ConsultationMediaStage } from '../../components/consultation/ConsultationMediaStage';
import { ConsultationClinicalPanel } from '../../components/consultation/ConsultationClinicalPanel';
import { DeviceReadinessModal } from '../../components/consultation/DeviceReadinessModal';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { getAppointment } from '../../api/dentistEndpoints';
import {
  ArrowLeft,
  PlayCircle,
  CheckCircle,
  XCircle,
  MessageSquare,
} from 'lucide-react';

export const DentistConsultationRoomPage: React.FC = () => {
  const { consultationId } = useParams<{ consultationId: string }>();
  const navigate = useNavigate();

  const {
    consultation,
    loading,
    error,
    elapsedSeconds,
    refetch,
    startSession,
    endSession,
    failSession,
    actionLoading,
  } = useConsultation(consultationId);

  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState<boolean>(false);
  const [isEndModalOpen, setIsEndModalOpen] = useState<boolean>(false);
  const [isFailModalOpen, setIsFailModalOpen] = useState<boolean>(false);
  const [clinicalSummary, setClinicalSummary] = useState<string>('');
  const [screeningId, setScreeningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Initialize clinical summary from consultation if present
  useEffect(() => {
    if (consultation?.clinical_summary) {
      setClinicalSummary(consultation.clinical_summary);
    }
  }, [consultation?.clinical_summary]);

  // Fetch appointment to extract associated screening ID
  useEffect(() => {
    if (!consultation?.appointment_id) return;

    const fetchAppt = async () => {
      try {
        const appt = await getAppointment(consultation.appointment_id);
        if (appt.screening_id) {
          setScreeningId(appt.screening_id);
        }
      } catch {
        // Continue gracefully if appointment lookup fails
      }
    };

    fetchAppt();
  }, [consultation?.appointment_id]);

  const handleStart = async () => {
    setActionError(null);
    try {
      await startSession();
      refetch();
    } catch (err: unknown) {
      const e = err as Error;
      setActionError(e.message || 'Failed to start consultation session.');
    }
  };

  const handleEnd = async () => {
    setActionError(null);
    try {
      await endSession({
        clinical_summary: clinicalSummary.trim() || undefined,
      });
      setIsEndModalOpen(false);
      refetch();
    } catch (err: unknown) {
      const e = err as Error;
      setActionError(e.message || 'Failed to conclude consultation.');
    }
  };

  const handleFail = async () => {
    setActionError(null);
    try {
      await failSession();
      setIsFailModalOpen(false);
      refetch();
    } catch (err: unknown) {
      const e = err as Error;
      setActionError(e.message || 'Failed to mark consultation as failed.');
    }
  };

  if (loading && !consultation) {
    return (
      <div className="max-w-7xl mx-auto py-8">
        <LoadingSkeleton count={4} />
      </div>
    );
  }

  if (error || !consultation) {
    return (
      <div className="max-w-7xl mx-auto py-8">
        <ErrorState
          title="Consultation Unavailable"
          message={error || 'Consultation record not found.'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const isTerminal = consultation.session_status === 'ended' || consultation.session_status === 'failed';

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <button
          type="button"
          onClick={() => navigate('/dentist/appointments')}
          className="flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Clinical Appointments</span>
        </button>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {actionError && (
            <span className="text-xs text-red-600 mr-2">{actionError}</span>
          )}

          {consultation.session_status === 'scheduled' && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setIsFailModalOpen(true)}
                disabled={actionLoading}
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Cancel Session
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleStart}
                loading={actionLoading}
              >
                <PlayCircle className="h-3.5 w-3.5 mr-1" />
                Start Consultation
              </Button>
            </>
          )}

          {consultation.session_status === 'active' && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setIsFailModalOpen(true)}
                disabled={actionLoading}
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Fail / Abort
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="text-xs bg-sky-600 hover:bg-sky-700 text-white"
                onClick={() => setIsEndModalOpen(true)}
                disabled={actionLoading}
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Conclude Consultation
              </Button>
            </>
          )}

          {isTerminal && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 italic">
                Consultation is {consultation.session_status}.
              </span>
              <Button
                variant="outline"
                size="sm"
                className="text-xs flex items-center gap-1.5 text-clinical-600 border-clinical-200 hover:bg-clinical-50"
                onClick={() => navigate('/dentist/messages')}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Follow up via Message</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main 2-Column Clinical Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (7 cols): Media Stage */}
        <div className="lg:col-span-7 space-y-4">
          <ConsultationMediaStage
            consultation={consultation}
            elapsedSeconds={elapsedSeconds}
            onOpenDeviceCheck={() => setIsDeviceModalOpen(true)}
            isDentist={true}
          />
        </div>

        {/* Right Column (5 cols): Diagnostic Clinical Panel */}
        <div className="lg:col-span-5 h-[620px]">
          <ConsultationClinicalPanel
            screeningId={screeningId}
            clinicalSummary={clinicalSummary}
            onClinicalSummaryChange={setClinicalSummary}
            isReadOnly={isTerminal}
          />
        </div>
      </div>

      {/* Device Readiness Modal */}
      <DeviceReadinessModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
      />

      {/* Conclude Session Confirmation Modal */}
      <Modal
        isOpen={isEndModalOpen}
        onClose={() => setIsEndModalOpen(false)}
        title="Conclude Clinical Consultation"
        maxWidth="md"
      >
        <div className="space-y-4 py-2 text-xs">
          <p className="text-slate-600">
            Concluding this consultation transitions the session status to <strong>ended</strong> and the underlying appointment status to <strong>completed</strong>.
            The clinical summary below will be permanently written to the appointment record.
          </p>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="font-semibold text-slate-700">Clinical Summary Preview:</span>
            <p className="text-slate-600 italic">
              {clinicalSummary.trim() || 'No clinical summary documented.'}
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEndModalOpen(false)}
              disabled={actionLoading}
            >
              Continue Session
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleEnd}
              loading={actionLoading}
            >
              Conclude & Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Fail Session Confirmation Modal */}
      <Modal
        isOpen={isFailModalOpen}
        onClose={() => setIsFailModalOpen(false)}
        title="Mark Consultation as Failed"
        maxWidth="sm"
      >
        <div className="space-y-4 py-2 text-xs">
          <p className="text-slate-600">
            This transitions the session status to <strong>failed</strong>. The underlying appointment status will remain unchanged per the clinical workflow contract.
          </p>

          <div className="flex justify-end space-x-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFailModalOpen(false)}
              disabled={actionLoading}
            >
              Back
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleFail}
              loading={actionLoading}
            >
              Confirm Fail
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
