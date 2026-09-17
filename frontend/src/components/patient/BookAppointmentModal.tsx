/**
 * OraVisionAI — Book Consultation Appointment Modal
 *
 * Allows patients to view a dentist's availability, choose a date and time slot,
 * select consultation modality, and book/request an appointment.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  DentistProfile,
  DentistAvailability,
  Appointment,
  AppointmentType,
} from '../../types/dentist';
import {
  getDentistPublicAvailability,
  bookAppointmentWithDentist,
} from '../../api/dentistEndpoints';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import {
  Video,
  Phone,
  Building,
  CheckCircle2,
  X,
} from 'lucide-react';

export interface BookAppointmentModalProps {
  dentist: DentistProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (appointment: Appointment) => void;
}

const APPOINTMENT_TYPES: { value: AppointmentType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'video_teleconsultation', label: 'Video Teleconsultation', icon: Video },
  { value: 'audio_teleconsultation', label: 'Audio Teleconsultation', icon: Phone },
  { value: 'in_person_consultation', label: 'In-Person Clinic Visit', icon: Building },
  { value: 'follow_up', label: 'Follow-up Review', icon: CheckCircle2 },
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Helper to format date to YYYY-MM-DD
function toDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Generate slots within a window
function generateSlots(startTimeStr: string, endTimeStr: string, durationMinutes: number): string[] {
  const slots: string[] = [];
  const [startH, startM] = startTimeStr.split(':').map(Number);
  const [endH, endM] = endTimeStr.split(':').map(Number);

  let currentMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  while (currentMinutes + durationMinutes <= endMinutes) {
    const h = Math.floor(currentMinutes / 60);
    const m = currentMinutes % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    currentMinutes += durationMinutes;
  }
  return slots;
}

export const BookAppointmentModal: React.FC<BookAppointmentModalProps> = ({
  dentist,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [availabilities, setAvailabilities] = useState<DentistAvailability[]>([]);
  const [loadingAvail, setLoadingAvail] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toDateInputValue(tomorrow);
  });
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [appointmentType, setAppointmentType] = useState<AppointmentType>('video_teleconsultation');
  const [patientNotes, setPatientNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load dentist public availability when modal opens
  useEffect(() => {
    if (!isOpen || !dentist) return;
    setError(null);
    setSelectedSlot('');
    setLoadingAvail(true);

    getDentistPublicAvailability(dentist.id)
      .then((res) => {
        setAvailabilities(res.items || []);
      })
      .catch((err) => {
        console.warn('Could not load specific availability windows, using general hours:', err);
        setAvailabilities([]);
      })
      .finally(() => {
        setLoadingAvail(false);
      });
  }, [isOpen, dentist]);

  // Determine available slots for the selected date strictly from dentist_availabilities
  const availableSlots = useMemo(() => {
    if (!selectedDate) return [];
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const dayOfWeek = dateObj.getUTCDay();

    const dayAvailabilities = availabilities.filter(
      (a) => a.day_of_week === dayOfWeek && a.is_active,
    );

    if (dayAvailabilities.length > 0) {
      const allSlots: string[] = [];
      for (const window of dayAvailabilities) {
        const slots = generateSlots(
          window.start_time,
          window.end_time,
          window.slot_duration_minutes || 30,
        );
        allSlots.push(...slots);
      }
      return Array.from(new Set(allSlots)).sort();
    }

    // Strictly NO synthetic slots if practitioner has no active availability for this day
    return [];
  }, [selectedDate, availabilities]);

  if (!isOpen || !dentist) return null;

  const minDate = toDateInputValue(new Date());

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) {
      setError('Please select a consultation time slot.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const [h, min] = selectedSlot.split(':').map(Number);
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      const dayOfWeek = dateObj.getUTCDay();

      const startMinutes = h * 60 + min;

      const matchingWindow = availabilities.find((a) => {
        if (a.day_of_week !== dayOfWeek || !a.is_active) return false;
        const [wStartH, wStartM] = a.start_time.split(':').map(Number);
        const [wEndH, wEndM] = a.end_time.split(':').map(Number);
        const wStart = wStartH * 60 + wStartM;
        const wEnd = wEndH * 60 + wEndM;
        return startMinutes >= wStart && startMinutes < wEnd;
      });

      const slotDuration = matchingWindow?.slot_duration_minutes || 30;
      const endMinutes = startMinutes + slotDuration;
      const endH = Math.floor(endMinutes / 60);
      const endM = endMinutes % 60;
      const endSlot = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

      // Authoritative UTC ISO-8601 timestamps matching backend availability windows
      const scheduledStart = `${selectedDate}T${selectedSlot}:00Z`;
      const scheduledEnd = `${selectedDate}T${endSlot}:00Z`;

      const created = await bookAppointmentWithDentist(dentist.id, {
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        appointment_type: appointmentType,
        patient_notes: patientNotes.trim() ? patientNotes.trim() : undefined,
      });

      onSuccess(created);
      onClose();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || 'Failed to book appointment.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-modal-title"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-clinical-100 text-clinical-700 flex items-center justify-center font-semibold text-sm">
              {dentist.first_name[0]}{dentist.last_name[0]}
            </div>
            <div>
              <h3 id="book-modal-title" className="text-base font-semibold text-slate-900">
                Book Consultation
              </h3>
              <p className="text-xs text-slate-500">
                Dr. {dentist.first_name} {dentist.last_name} • {dentist.specialization}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleBookingSubmit} className="p-5 space-y-4">
          {error && (
            <Alert variant="danger" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Practitioner Summary Card */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <div>
              <span className="font-medium text-slate-900">{dentist.clinic_name || 'OraVision Partner Clinic'}</span>
              {dentist.clinic_address && <p className="text-slate-500 mt-0.5">{dentist.clinic_address}</p>}
            </div>
            <Badge variant="success" className="text-[10px]">
              Verified Practitioner
            </Badge>
          </div>

          {/* Consultation Modality Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Consultation Modality
            </label>
            <div className="grid grid-cols-2 gap-2">
              {APPOINTMENT_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = appointmentType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setAppointmentType(type.value)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all text-left ${
                      isSelected
                        ? 'border-clinical-600 bg-clinical-50/80 text-clinical-900 font-semibold shadow-sm ring-1 ring-clinical-500'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isSelected ? 'text-clinical-700' : 'text-slate-400'}`} />
                    <span>{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label htmlFor="appointment-date" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Consultation Date
            </label>
            <div className="relative">
              <input
                id="appointment-date"
                type="date"
                min={minDate}
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedSlot('');
                }}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-clinical-500"
                required
              />
            </div>
          </div>

          {/* Time Slot Picker */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Available Time Slots (30 min)
              </label>
              <span className="text-[11px] text-slate-400">
                {DAY_NAMES[new Date(`${selectedDate}T12:00:00`).getDay()]}
              </span>
            </div>

            {loadingAvail ? (
              <div className="py-4 text-center text-xs text-slate-400">Loading practitioner schedule...</div>
            ) : availableSlots.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                No available consultation slots for this date. Please select another date when the dentist is available.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1">
                {availableSlots.map((slot) => {
                  const isSelected = selectedSlot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                        isSelected
                          ? 'bg-clinical-600 border-clinical-600 text-white shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50 hover:bg-slate-100'
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Patient Reason / Clinical Notes */}
          <div>
            <label htmlFor="patient-notes" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Reason for Consultation (Optional)
            </label>
            <textarea
              id="patient-notes"
              rows={2}
              value={patientNotes}
              onChange={(e) => setPatientNotes(e.target.value)}
              placeholder="e.g., Follow-up on lesion reported on lower lip screening, slight discomfort..."
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-clinical-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submitting}
              disabled={!selectedSlot || availableSlots.length === 0 || submitting}
            >
              Confirm Appointment Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookAppointmentModal;
