/**
 * OraVisionAI — Patient Teleconsultation Room Page (Phase 25)
 *
 * Dedicated consultation room container for patients, featuring:
 * - Real-time session state synchronization
 * - Media stage with transparent infrastructure disclosure banner
 * - Local hardware readiness check modal
 * - Attached screening overview via patient screening endpoint
 * - Cancellation control strictly guarded for scheduled sessions only
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useConsultation } from '../../hooks/useConsultation';
import { ConsultationMediaStage } from '../../components/consultation/ConsultationMediaStage';
import { DeviceReadinessModal } from '../../components/consultation/DeviceReadinessModal';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import { ErrorState } from '../../components/feedback/ErrorState';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { getScreeningDetail as getScreening } from '../../api/screeningEndpoints';
import { ScreeningResponse } from '../../types/screening';
import {
  ArrowLeft,
  FileText,
  Clock,
  XCircle,
  MessageSquare,
} from 'lucide-react';
import { formatAppointmentDateTime } from '../../utils/dateTimeUtils';

export const PatientConsultationRoomPage: React.FC = () => {
  const { consultationId } = useParams<{ consultationId: string }>();
  const navigate = useNavigate();

  const {
    consultation,
    loading,
    error,
    elapsedSeconds,
    refetch,
    failSession,
    actionLoading,
  } = useConsultation(consultationId);

  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState<boolean>(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [attachedScreening, setAttachedScreening] = useState<ScreeningResponse | null>(null);

  // If consultation has an appointment with screening, fetch attached screening using patient endpoint
  useEffect(() => {
    if (!consultation?.appointment_id) return;
    const checkAttachedScreening = async () => {
      try {
        if (consultation.stream_channel_id) {
          const s = await getScreening(consultation.stream_channel_id);
          setAttachedScreening(s);
        }
      } catch {
        // Continue gracefully if lookup fails
      }
    };
    checkAttachedScreening();
  }, [consultation]);

  const handleCancel = async () => {
    setCancelError(null);
    try {
      await failSession();
      setIsCancelModalOpen(false);
      refetch();
    } catch (err: unknown) {
      const e = err as Error;
      setCancelError(e.message || 'Unable to cancel consultation.');
    }
  };

  if (loading && !consultation) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <LoadingSkeleton count={4} />
      </div>
    );
  }

  if (error || !consultation) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <ErrorState
          title="Consultation Unavailable"
          message={error || 'Consultation record not found.'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/patient/consultations')}
          className="flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Teleconsultations</span>
        </button>

        <div className="text-xs text-slate-500">
          Session ID: <span className="font-mono">{consultation.id.substring(0, 8)}...</span>
        </div>
      </div>

      {/* Main Visual Stage */}
      <ConsultationMediaStage
        consultation={consultation}
        elapsedSeconds={elapsedSeconds}
        onOpenDeviceCheck={() => setIsDeviceModalOpen(true)}
        isDentist={false}
      />

      {/* Patient Information & Session Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left 2 Cols: Session Details */}
        <Card className="md:col-span-2 border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center space-x-2">
              <Clock className="h-4 w-4 text-sky-600" />
              <span>Session Overview & Clinical Notes</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-600">
            <div className="p-3 bg-slate-50 rounded-lg space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Practitioner</span>
                <span className="font-medium text-slate-800">{consultation.dentist_name || 'Assigned Dental Practitioner'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Clinic</span>
                <span className="font-medium text-slate-800">{consultation.clinic_name || 'OraVision Clinical Partner'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Scheduled Date</span>
                <span className="font-medium text-slate-800">
                  {consultation.scheduled_start
                    ? formatAppointmentDateTime(consultation.scheduled_start)
                    : 'Scheduled by Clinic'}
                </span>
              </div>
            </div>

            {attachedScreening && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <p className="font-semibold text-slate-800">Attached Oral Screening</p>
                <p className="text-slate-600">Status: {attachedScreening.status}</p>
              </div>
            )}

            {consultation.clinical_summary && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1">
                <p className="font-semibold text-emerald-900 flex items-center space-x-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Clinical Summary from Practitioner</span>
                </p>
                <p className="text-emerald-800 leading-relaxed">{consultation.clinical_summary}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right 1 Col: Session Actions */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-800">
              Session Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {consultation.session_status === 'scheduled' && (
              <div className="space-y-2">
                <p className="text-slate-500">
                  Need to reschedule or cancel this session? You may cancel while the session is scheduled.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-red-200 text-red-700 hover:bg-red-50 flex items-center justify-center space-x-1.5"
                  onClick={() => setIsCancelModalOpen(true)}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  <span>Cancel Session</span>
                </Button>
              </div>
            )}

            {consultation.session_status === 'active' && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 space-y-1">
                <p className="font-semibold">Consultation in Progress</p>
                <p className="text-[11px] leading-relaxed">
                  The session is currently active. The dental practitioner is conducting the clinical evaluation.
                </p>
              </div>
            )}

            {(consultation.session_status === 'ended' || consultation.session_status === 'failed') && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 space-y-2">
                <div>
                  <p className="font-semibold">Session Concluded</p>
                  <p className="text-[11px]">
                    This teleconsultation has been completed. All records are stored securely in your patient profile.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/patient/messages')}
                  className="w-full text-xs flex items-center justify-center gap-1.5 text-clinical-600 border-clinical-200 hover:bg-clinical-50"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Follow up via Message</span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Hardware Readiness Modal */}
      <DeviceReadinessModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
      />

      {/* Cancellation Confirmation Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Teleconsultation"
        maxWidth="sm"
      >
        <div className="space-y-4 py-2 text-xs">
          <p className="text-slate-600">
            Cancelling this session will mark the consultation as failed. The underlying appointment record will remain unchanged.
          </p>

          {cancelError && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 rounded-lg">
              {cancelError}
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCancelModalOpen(false)}
              disabled={actionLoading}
            >
              Keep Session
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleCancel}
              loading={actionLoading}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
