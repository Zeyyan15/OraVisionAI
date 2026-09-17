/**
 * OraVisionAI — Patient Appointments Management Page
 *
 * Displays personal scheduled consultations, status lifecycle progress,
 * video teleconsultation access, and cancellation controls.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Appointment } from '../../types/dentist';
import { listAppointments, cancelAppointment } from '../../api/dentistEndpoints';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import { LoadingSkeleton } from '../../components/feedback/LoadingSkeleton';
import {
  Calendar,
  Clock,
  Video,
  Phone,
  Building,
  AlertCircle,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  formatAppointmentMonth,
  formatAppointmentDay,
  formatAppointmentTimeRange,
} from '../../utils/dateTimeUtils';

export const PatientAppointmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cancellingAppointment, setCancellingAppointment] = useState<Appointment | null>(null);
  const [cancellationReason, setCancellationReason] = useState<string>('');
  const [cancelSubmitting, setCancelSubmitting] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const fetchAppointments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listAppointments();
      setAppointments(res.items || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const filteredAppointments = useMemo(() => {
    if (statusFilter === 'all') return appointments;
    if (statusFilter === 'upcoming') {
      return appointments.filter(
        (a) => a.status === 'requested' || a.status === 'confirmed' || a.status === 'in_progress',
      );
    }
    return appointments.filter((a) => a.status === statusFilter);
  }, [appointments, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="success">Confirmed</Badge>;
      case 'requested':
        return <Badge variant="warning">Pending Confirmation</Badge>;
      case 'in_progress':
        return <Badge variant="info">In Progress</Badge>;
      case 'completed':
        return <Badge variant="neutral">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getModalityIcon = (type: string) => {
    switch (type) {
      case 'video_teleconsultation':
        return <Video className="h-4 w-4 text-sky-600" />;
      case 'audio_teleconsultation':
        return <Phone className="h-4 w-4 text-indigo-600" />;
      default:
        return <Building className="h-4 w-4 text-emerald-600" />;
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingAppointment) return;
    if (!cancellationReason.trim() || cancellationReason.trim().length < 3) {
      setCancelError('Please provide a valid cancellation reason (at least 3 characters).');
      return;
    }

    setCancelSubmitting(true);
    setCancelError(null);
    try {
      await cancelAppointment(cancellingAppointment.id, {
        cancellation_reason: cancellationReason.trim(),
      });
      setCancellingAppointment(null);
      setCancellationReason('');
      fetchAppointments();
    } catch (err: any) {
      setCancelError(err?.message || 'Failed to cancel appointment.');
    } finally {
      setCancelSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            My Appointments
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review upcoming visits, consultation statuses, and telehealth sessions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAppointments}
            disabled={loading}
            leftIcon={RefreshCw}
            className={loading ? 'animate-spin-icon' : ''}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/patient/dentists')}
            leftIcon={Plus}
          >
            Book New Appointment
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { key: 'all', label: `All (${appointments.length})` },
          {
            key: 'upcoming',
            label: `Upcoming (${
              appointments.filter(
                (a) => a.status === 'requested' || a.status === 'confirmed' || a.status === 'in_progress',
              ).length
            })`,
          },
          {
            key: 'completed',
            label: `Completed (${appointments.filter((a) => a.status === 'completed').length})`,
          },
          {
            key: 'cancelled',
            label: `Cancelled (${appointments.filter((a) => a.status === 'cancelled').length})`,
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === tab.key
                ? 'bg-clinical-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="space-y-4">
          <LoadingSkeleton variant="card" count={2} />
        </div>
      ) : error ? (
        <Alert variant="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : filteredAppointments.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent className="space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <Calendar className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">No Appointments Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You do not have any appointments matching the selected filter. Browse verified dentists to request a consultation.
            </p>
            <div className="pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/patient/dentists')}
                leftIcon={Plus}
              >
                Find a Dentist
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAppointments.map((appt) => {
            const canCancel = appt.status === 'requested' || appt.status === 'confirmed';

            return (
              <Card key={appt.id} className="hover:border-slate-300 transition-colors">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-slate-100 text-slate-700 shrink-0 text-center min-w-[64px]">
                        <p className="text-xs uppercase font-semibold text-slate-500">
                          {formatAppointmentMonth(appt.scheduled_start)}
                        </p>
                        <p className="text-xl font-bold text-slate-900">
                          {formatAppointmentDay(appt.scheduled_start)}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base font-semibold text-slate-900">
                            {appt.dentist_name ? `Dr. ${appt.dentist_name}` : 'Dental Practitioner Consultation'}
                          </h4>
                          {getStatusBadge(appt.status)}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1 font-medium">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            {formatAppointmentTimeRange(appt.scheduled_start, appt.scheduled_end)}
                          </span>

                          <span className="flex items-center gap-1">
                            {getModalityIcon(appt.appointment_type)}
                            <span className="capitalize">{appt.appointment_type.replace(/_/g, ' ')}</span>
                          </span>

                          {appt.clinic_name && (
                            <span className="flex items-center gap-1">
                              <Building className="h-3.5 w-3.5 text-slate-400" />
                              {appt.clinic_name}
                            </span>
                          )}
                        </div>

                        {appt.patient_notes && (
                          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-md mt-2 border border-slate-100">
                            <strong className="text-slate-700">Patient Notes:</strong> {appt.patient_notes}
                          </p>
                        )}

                        {appt.status === 'cancelled' && appt.cancellation_reason && (
                          <p className="text-xs text-rose-700 bg-rose-50 p-2 rounded-md mt-2 border border-rose-200">
                            <strong>Cancellation Reason:</strong> {appt.cancellation_reason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                      {appt.appointment_type === 'video_teleconsultation' &&
                        (appt.status === 'confirmed' || appt.status === 'in_progress') && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => navigate('/patient/consultations')}
                            leftIcon={Video}
                          >
                            Join Teleconsultation
                          </Button>
                        )}

                      {canCancel && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          onClick={() => {
                            setCancellingAppointment(appt);
                            setCancellationReason('');
                            setCancelError(null);
                          }}
                        >
                          Cancel Appointment
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Cancel Appointment Confirmation Modal */}
      {cancellingAppointment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-rose-600" />
                Cancel Appointment
              </h3>
              <button
                type="button"
                onClick={() => setCancellingAppointment(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {cancelError && (
              <Alert variant="danger" onClose={() => setCancelError(null)}>
                {cancelError}
              </Alert>
            )}

            <p className="text-xs text-slate-600">
              Are you sure you want to cancel your scheduled appointment with{' '}
              <strong>{cancellingAppointment.dentist_name || 'the dentist'}</strong>? Please provide a reason for the practitioner.
            </p>

            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cancellation Reason (Required)
                </label>
                <textarea
                  rows={3}
                  required
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="e.g. Schedule conflict, feeling better, need to reschedule..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-clinical-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCancellingAppointment(null)}
                  disabled={cancelSubmitting}
                >
                  Keep Appointment
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  loading={cancelSubmitting}
                  disabled={!cancellationReason.trim() || cancelSubmitting}
                >
                  Confirm Cancellation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientAppointmentsPage;
