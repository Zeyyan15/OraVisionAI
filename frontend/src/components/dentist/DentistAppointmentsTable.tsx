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
import { Appointment, AppointmentStatus, AppointmentStatusUpdate, AppointmentCancel } from '../../types/dentist';
import { initiatePatientConversation } from '../../api/communicationEndpoints';

export interface DentistAppointmentsTableProps {
  appointments: Appointment[];
  loading: boolean;
  onUpdateStatus?: (id: string, data: AppointmentStatusUpdate) => Promise<unknown>;
  onCancel?: (id: string, data: AppointmentCancel) => Promise<unknown>;
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

export const DentistAppointmentsTable: React.FC<DentistAppointmentsTableProps> = ({
  appointments,
  loading,
  onUpdateStatus,
  onCancel,
}) => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [cancelModalAppointment, setCancelModalAppointment] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
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
                  const startDate = new Date(appt.scheduled_start);

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
                          </div>
                        </div>
                      </td>

                      {/* Scheduled Start */}
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-slate-900 font-medium text-xs">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span>{startDate.toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                            <Clock className="h-3 w-3 text-slate-400" />
                            <span>
                              {startDate.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
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

                          {['requested', 'confirmed'].includes(appt.status) && onCancel && (
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
    </Card>
  );
};

export default DentistAppointmentsTable;
