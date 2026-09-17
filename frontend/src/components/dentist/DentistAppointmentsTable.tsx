/**
 * OraVisionAI — Dentist Appointments Queue Table (Phase 24)
 *
 * Displays clinical appointment queue with status filtering, direct patient
 * screening navigation, and lifecycle transitions.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { getConsultationForAppointment, createConsultationForAppointment } from '../../api/consultations';
import {
  Calendar,
  Clock,
  Video,
  User,
  ExternalLink,
  CheckCircle,
  PlayCircle,
  XCircle,
  Filter,
  MessageSquare,
} from 'lucide-react';
import {
  Appointment,
  AppointmentStatus,
  AppointmentStatusUpdate,
  AppointmentCancel,
  AppointmentConfirm,
} from '../../types/dentist';
import { initiatePatientConversation } from '../../api/communicationEndpoints';
import { formatAppointmentDate, formatAppointmentTimeRange } from '../../utils/dateTimeUtils';

export interface DentistAppointmentsTableProps {
  appointments: Appointment[];
  loading: boolean;
  onUpdateStatus?: (id: string, data: AppointmentStatusUpdate) => Promise<unknown>;
  onCancel?: (id: string, data: AppointmentCancel) => Promise<unknown>;
  onConfirm?: (id: string, data?: AppointmentConfirm) => Promise<unknown>;
  onReject?: (id: string, data: AppointmentCancel) => Promise<unknown>;
}

const STATUS_VARIANTS: Record<
  string,
  { label: string; variant: 'neutral' | 'success' | 'warning' | 'danger' }
> = {
  requested: { label: 'Requested', variant: 'neutral' },
  confirmed: { label: 'Confirmed', variant: 'warning' },
  in_progress: { label: 'In Progress', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
  rescheduled: { label: 'Rescheduled', variant: 'neutral' },
  no_show: { label: 'No Show', variant: 'danger' },
};

const PREDEFINED_REJECTION_REASONS = [
  'Schedule unavailable — please select another slot.',
  'Existing schedule conflict — please choose another time.',
  'Dentist unavailable at this time.',
  'Please select another available appointment slot.',
  'Other',
];

export const DentistAppointmentsTable: React.FC<DentistAppointmentsTableProps> = ({
  appointments,
  loading,
  onUpdateStatus,
  onCancel,
  onConfirm,
  onReject,
}) => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [cancelModalAppointment, setCancelModalAppointment] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [confirmModalAppointment, setConfirmModalAppointment] = useState<Appointment | null>(null);
  const [confirming, setConfirming] = useState<boolean>(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const [rejectModalAppointment, setRejectModalAppointment] = useState<Appointment | null>(null);
  const [selectedPredefinedReason, setSelectedPredefinedReason] = useState<string>(PREDEFINED_REJECTION_REASONS[0]);
  const [customRejectReason, setCustomRejectReason] = useState<string>('');
  const [rejecting, setRejecting] = useState<boolean>(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [messagingId, setMessagingId] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);

  const handleMessagePatient = async (patientId: string) => {
    setMessagingId(patientId);
    setMessageError(null);
    try {
      const conv = await initiatePatientConversation(patientId);
      navigate(`/dentist/messages/${conv.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to initiate message thread with patient.';
      setMessageError(msg);
    } finally {
      setMessagingId(null);
    }
  };

  const handleLaunchConsultation = async (appt: Appointment) => {
    setLaunchingId(appt.id);
    try {
      let consultation;
      try {
        consultation = await getConsultationForAppointment(appt.id);
      } catch {
        const consultationType = appt.appointment_type === 'audio_teleconsultation' ? 'audio' : 'video';
        consultation = await createConsultationForAppointment(appt.id, {
          consultation_type: consultationType,
        });
      }
      if (consultation && consultation.id) {
        navigate(`/dentist/consultations/${consultation.id}`);
      }
    } catch {
      // Continue gracefully
    } finally {
      setLaunchingId(null);
    }
  };

  const filteredAppointments = appointments.filter((appt) => {
    if (activeFilter === 'all') return true;
    return appt.status === activeFilter;
  });

  const handleOpenCancelModal = (appt: Appointment) => {
    setCancelModalAppointment(appt);
    setCancelReason('');
    setCancelError(null);
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalAppointment || !onCancel) return;
    if (cancelReason.trim().length < 3) {
      setCancelError('Please provide a cancellation reason (minimum 3 characters).');
      return;
    }
    setCancelling(true);
    setCancelError(null);
    try {
      await onCancel(cancelModalAppointment.id, { cancellation_reason: cancelReason.trim() });
      setCancelModalAppointment(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel appointment';
      setCancelError(msg);
    } finally {
      setCancelling(false);
    }
  };

  const handleOpenConfirmModal = (appt: Appointment) => {
    setConfirmModalAppointment(appt);
    setConfirmError(null);
  };

  const handleExecuteConfirm = async () => {
    if (!confirmModalAppointment) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      if (onConfirm) {
        await onConfirm(confirmModalAppointment.id);
      } else if (onUpdateStatus) {
        await onUpdateStatus(confirmModalAppointment.id, {
          status: 'confirmed' as AppointmentStatus,
        });
      }
      setConfirmModalAppointment(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to confirm appointment';
      setConfirmError(msg);
    } finally {
      setConfirming(false);
    }
  };

  const handleOpenRejectModal = (appt: Appointment) => {
    setRejectModalAppointment(appt);
    setSelectedPredefinedReason(PREDEFINED_REJECTION_REASONS[0]);
    setCustomRejectReason('');
    setRejectError(null);
  };

  const handleExecuteReject = async () => {
    if (!rejectModalAppointment) return;

    let finalReason = '';
    if (selectedPredefinedReason === 'Other') {
      const trimmed = customRejectReason.trim();
      if (trimmed.length < 3) {
        setRejectError('Please provide a specific rejection reason (minimum 3 characters).');
        return;
      }
      finalReason = trimmed;
    } else {
      finalReason = selectedPredefinedReason;
    }

    setRejecting(true);
    setRejectError(null);
    try {
      if (onReject) {
        await onReject(rejectModalAppointment.id, { cancellation_reason: finalReason });
      } else if (onCancel) {
        await onCancel(rejectModalAppointment.id, { cancellation_reason: finalReason });
      }
      setRejectModalAppointment(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reject appointment';
      setRejectError(msg);
    } finally {
      setRejecting(false);
    }
  };

  const formatType = (typeStr: string) => {
    switch (typeStr) {
      case 'video_teleconsultation':
        return 'Video Teleconsultation';
      case 'audio_teleconsultation':
        return 'Audio Consultation';
      case 'in_person_consultation':
        return 'In-Person Consultation';
      case 'follow_up':
        return 'Follow-Up Review';
      default:
        return typeStr.replace(/_/g, ' ');
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-lg text-slate-900">
              Clinical Appointments & Case Queue
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Scheduled patient consultations and associated oral screenings
            </CardDescription>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="h-4 w-4 text-slate-400 mr-1" />
            {['all', 'confirmed', 'in_progress', 'completed', 'cancelled'].map((filterKey) => (
              <button
                key={filterKey}
                type="button"
                onClick={() => setActiveFilter(filterKey)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  activeFilter === filterKey
                    ? 'bg-clinical-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {filterKey === 'all'
                  ? 'All'
                  : filterKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {messageError && (
          <div className="mx-6 my-3 p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center justify-between">
            <span>{messageError}</span>
            <button
              onClick={() => setMessageError(null)}
              className="text-red-600 hover:text-red-800 font-semibold text-xs ml-2"
            >
              Dismiss
            </button>
          </div>
        )}
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-clinical-600 border-t-transparent mb-2" />
            <p>Loading appointments queue...</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <h4 className="text-sm font-semibold text-slate-900">No appointments found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              There are currently no appointments matching the selected filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5">Patient</th>
                  <th className="px-6 py-3.5">Date & Time</th>
                  <th className="px-6 py-3.5">Consultation Type</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Screening Link</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAppointments.map((appt) => {
                  const statusInfo = STATUS_VARIANTS[appt.status] || {
                    label: appt.status,
                    variant: 'neutral',
                  };

                  return (
                    <tr key={appt.id} className="hover:bg-slate-50/75 transition-colors">
                      {/* Patient Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-clinical-50 flex items-center justify-center text-clinical-700">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block">
                              {appt.patient_name || 'Patient'}
                            </span>
                            {appt.patient_notes && (
                              <span className="text-[11px] text-slate-400 block max-w-xs truncate">
                                "{appt.patient_notes}"
                              </span>
                            )}
                            {appt.status === 'cancelled' && appt.cancellation_reason && (
                              <span className="text-[11px] text-rose-600 block max-w-sm mt-1 font-medium">
                                <span className="font-semibold text-rose-700">Cancellation Reason:</span> {appt.cancellation_reason}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Scheduled Start */}
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-slate-900 font-medium text-xs">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span>{formatAppointmentDate(appt.scheduled_start)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span>
                              {formatAppointmentTimeRange(appt.scheduled_start, appt.scheduled_end)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700">
                          <Video className="h-3.5 w-3.5 text-clinical-600" />
                          <span>{formatType(appt.appointment_type)}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <Badge variant={statusInfo.variant} className="text-xs">
                          {statusInfo.label}
                        </Badge>
                      </td>

                      {/* Screening Link */}
                      <td className="px-6 py-4">
                        {appt.screening_id ? (
                          <Link
                            to={`/dentist/screenings/${appt.screening_id}/review`}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-clinical-600 hover:text-clinical-700 hover:underline"
                          >
                            <span>Review Screening</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400 italic">None</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* REQUESTED state actions: Confirm and Reject */}
                          {appt.status === 'requested' && (
                            <>
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleOpenConfirmModal(appt)}
                                className="text-xs flex items-center gap-1 h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                <span>Confirm</span>
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenRejectModal(appt)}
                                className="text-xs flex items-center gap-1 h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                <span>Reject</span>
                              </Button>
                            </>
                          )}

                          {['confirmed', 'in_progress'].includes(appt.status) &&
                            ['video_teleconsultation', 'audio_teleconsultation'].includes(appt.appointment_type) && (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleLaunchConsultation(appt)}
                                loading={launchingId === appt.id}
                                className="text-xs flex items-center gap-1 h-7 px-2 bg-sky-600 hover:bg-sky-700 text-white"
                              >
                                <Video className="h-3.5 w-3.5" />
                                <span>Room</span>
                              </Button>
                            )}

                          {appt.status === 'confirmed' && onUpdateStatus && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                onUpdateStatus(appt.id, {
                                  status: 'in_progress' as AppointmentStatus,
                                })
                              }
                              className="text-xs flex items-center gap-1 h-7 px-2"
                            >
                              <PlayCircle className="h-3.5 w-3.5 text-amber-600" />
                              <span>Start</span>
                            </Button>
                          )}

                          {appt.status === 'in_progress' && onUpdateStatus && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                onUpdateStatus(appt.id, {
                                  status: 'completed' as AppointmentStatus,
                                })
                              }
                              className="text-xs flex items-center gap-1 h-7 px-2"
                            >
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                              <span>Complete</span>
                            </Button>
                          )}

                          {appt.status === 'confirmed' && onCancel && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenCancelModal(appt)}
                              className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 h-7 px-2"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              <span>Cancel</span>
                            </Button>
                          )}

                          {appt.patient_id && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMessagePatient(appt.patient_id)}
                              loading={messagingId === appt.patient_id}
                              title="Message Patient"
                              className="text-xs flex items-center gap-1 h-7 px-2 text-clinical-600 hover:text-clinical-700 hover:bg-clinical-50 border-clinical-200"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span>Message</span>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Cancel Modal */}
      <Modal
        isOpen={Boolean(cancelModalAppointment)}
        onClose={() => setCancelModalAppointment(null)}
        title="Cancel Appointment"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Please enter a mandatory reason for cancelling the appointment with{' '}
            <strong>{cancelModalAppointment?.patient_name || 'Patient'}</strong>.
          </p>

          {cancelError && (
            <p className="text-xs text-rose-600 font-medium">{cancelError}</p>
          )}

          <div className="space-y-1">
            <label htmlFor="cancel_reason" className="block text-xs font-semibold text-slate-700">
              Cancellation Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="cancel_reason"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Practitioner scheduling conflict, patient requested rescheduling..."
              className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-clinical-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCancelModalAppointment(null)}
              disabled={cancelling}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleConfirmCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Modal */}
      <Modal
        isOpen={Boolean(confirmModalAppointment)}
        onClose={() => {
          if (!confirming) setConfirmModalAppointment(null);
        }}
        title="Confirm Appointment Request"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Are you sure you want to confirm the appointment request with{' '}
            <strong>{confirmModalAppointment?.patient_name || 'Patient'}</strong>?
          </p>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 text-xs text-slate-700">
            <div className="flex items-center gap-1.5 font-medium text-slate-900">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>
                {confirmModalAppointment
                  ? formatAppointmentDate(confirmModalAppointment.scheduled_start)
                  : ''}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
              <Clock className="h-3 w-3 text-slate-400" />
              <span>
                {confirmModalAppointment
                  ? formatAppointmentTimeRange(
                      confirmModalAppointment.scheduled_start,
                      confirmModalAppointment.scheduled_end,
                    )
                  : ''}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Confirming will reserve this slot on your schedule and notify the patient.
          </p>

          {confirmError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              {confirmError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmModalAppointment(null)}
              disabled={confirming}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleExecuteConfirm}
              disabled={confirming}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {confirming ? 'Confirming...' : 'Confirm Appointment'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={Boolean(rejectModalAppointment)}
        onClose={() => {
          if (!rejecting) setRejectModalAppointment(null);
        }}
        title="Reject Appointment Request"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Please select a reason for declining the appointment request from{' '}
            <strong>{rejectModalAppointment?.patient_name || 'Patient'}</strong>.
            This explanation will be shared with the patient.
          </p>

          {rejectError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              {rejectError}
            </div>
          )}

          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-slate-700">
              Select Rejection Reason <span className="text-rose-500">*</span>
            </label>
            <div className="space-y-2">
              {PREDEFINED_REJECTION_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    selectedPredefinedReason === reason
                      ? 'border-clinical-500 bg-clinical-50/50 text-slate-900 font-medium'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="rejection_reason"
                    value={reason}
                    checked={selectedPredefinedReason === reason}
                    onChange={() => {
                      setSelectedPredefinedReason(reason);
                      setRejectError(null);
                    }}
                    className="mt-0.5 text-clinical-600 focus:ring-clinical-500"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            {selectedPredefinedReason === 'Other' && (
              <div className="mt-3 space-y-1.5 pt-2 border-t border-slate-100">
                <label htmlFor="custom_reject_reason" className="block text-xs font-semibold text-slate-700">
                  Custom Reason Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="custom_reject_reason"
                  rows={3}
                  value={customRejectReason}
                  onChange={(e) => {
                    setCustomRejectReason(e.target.value);
                    if (rejectError) setRejectError(null);
                  }}
                  placeholder="Enter detailed reason for declining this request (minimum 3 characters)..."
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-clinical-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRejectModalAppointment(null)}
              disabled={rejecting}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleExecuteReject}
              disabled={rejecting}
            >
              {rejecting ? 'Rejecting...' : 'Reject Appointment'}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
};

export default DentistAppointmentsTable;
