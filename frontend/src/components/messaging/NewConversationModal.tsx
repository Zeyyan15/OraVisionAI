/**
 * OraVisionAI — New Conversation Initiation Modal (Phase 27)
 *
 * Accessible modal allowing patient/dentist to select an authorized counterpart
 * and initiate/reactivate a direct 1:1 conversation thread.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { UserRole } from '../../types/domain';
import { ConversationResponse } from '../../types/communication';
import { initiateDentistConversation, initiatePatientConversation } from '../../api/communicationEndpoints';
import { apiClient } from '../../api/client';
import { API_PATHS } from '../../api/endpoints';
import { UserCheck, AlertCircle, Search, Calendar, Stethoscope } from 'lucide-react';
import { DentistProfile } from '../../types/dentist';

export interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationCreated: (conv: ConversationResponse) => void;
  currentRole: UserRole;
  initialCounterpartId?: string;
  initialCounterpartName?: string;
}

interface CounterpartOption {
  id: string; // Dentist ID or Patient ID
  name: string;
  subtext?: string;
}

export const NewConversationModal: React.FC<NewConversationModalProps> = ({
  isOpen,
  onClose,
  onConversationCreated,
  currentRole,
  initialCounterpartId,
  initialCounterpartName,
}) => {
  const [selectedId, setSelectedId] = useState<string>(initialCounterpartId || '');
  const [options, setOptions] = useState<CounterpartOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState<boolean>(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-load authorized eligible counterparts from appointments/consultations
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setOptionsError(null);

    if (initialCounterpartId) {
      setSelectedId(initialCounterpartId);
      if (initialCounterpartName) {
        setOptions([{ id: initialCounterpartId, name: initialCounterpartName }]);
      }
    }

    const loadOptions = async () => {
      setLoadingOptions(true);
      setOptionsError(null);
      try {
        if (currentRole === 'patient') {
          // Discover eligible dentists via established clinical relationships
          const practitioners = await apiClient.get<DentistProfile[]>(
            API_PATHS.MY_PRACTITIONERS,
          );
          const map = new Map<string, CounterpartOption>();
          for (const p of practitioners || []) {
            if (p.id && !map.has(p.id)) {
              map.set(p.id, {
                id: p.id,
                name: `Dr. ${p.first_name} ${p.last_name}`.trim(),
                subtext: p.clinic_name || p.specialization || 'Treating Practitioner',
              });
            }
          }
          const list = Array.from(map.values());
          setOptions(list);
          if (list.length === 1 && !initialCounterpartId) {
            setSelectedId(list[0].id);
          }
        } else if (currentRole === 'dentist') {
          // Fetch appointments to discover authorized patients
          const res = await apiClient.get<{ items: Array<{ patient_id: string; patient_name?: string | null }> }>(
            API_PATHS.APPOINTMENTS,
          );
          const map = new Map<string, CounterpartOption>();
          for (const a of res.items || []) {
            if (a.patient_id && !map.has(a.patient_id)) {
              map.set(a.patient_id, {
                id: a.patient_id,
                name: a.patient_name || 'Patient',
              });
            }
          }
          const list = Array.from(map.values());
          setOptions(list);
          if (list.length === 1 && !initialCounterpartId) {
            setSelectedId(list[0].id);
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to retrieve authorized partners.';
        setOptionsError(msg);
        setOptions([]);
      } finally {
        setLoadingOptions(false);
      }
    };

    loadOptions();
  }, [isOpen, currentRole, initialCounterpartId, initialCounterpartName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      let conv: ConversationResponse;
      if (currentRole === 'patient') {
        conv = await initiateDentistConversation(selectedId.trim());
      } else {
        conv = await initiatePatientConversation(selectedId.trim());
      }
      onConversationCreated(conv);
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Direct messaging requires an active patient-dentist relationship established via an appointment.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={currentRole === 'patient' ? 'Message a Dentist' : 'Message a Patient'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-500">
          {currentRole === 'patient'
            ? 'Start or resume a direct conversation with your treating dentist. Messaging requires an established patient-dentist relationship.'
            : 'Start or resume direct clinical messaging with one of your scheduled patients.'}
        </p>

        {/* Error States */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
            <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {optionsError && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
            <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{optionsError}</span>
          </div>
        )}

        {/* Counterpart Selection / Loading / Empty States */}
        <div>
          {loadingOptions ? (
            /* 1. Loading State */
            <div className="py-8 text-center space-y-2.5">
              <div className="h-5 w-5 border-2 border-clinical-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Loading your connected dentists...</p>
            </div>
          ) : options.length > 0 ? (
            /* 2. Success State */
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {currentRole === 'patient' ? 'Select Connected Dentist' : 'Select Scheduled Patient'}
              </label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-clinical-500 focus:outline-none focus:ring-1 focus:ring-clinical-500 bg-white"
              >
                <option value="">-- Choose from your connected practitioners --</option>
                {options.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name} {opt.subtext ? `(${opt.subtext})` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : currentRole === 'patient' ? (
            /* 3a. Empty State for Patient */
            <div className="space-y-3 py-2">
              <div className="rounded-lg bg-slate-50 p-5 text-center border border-slate-200 space-y-2">
                <Stethoscope className="h-7 w-7 text-slate-400 mx-auto" />
                <p className="text-xs font-semibold text-slate-800">No connected dentists yet.</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Direct messaging requires an established clinical relationship. Connect with an approved dentist by booking a consultation or requesting a clinical review.
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Link
                    to="/patient/dentists"
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-clinical-600 text-white hover:bg-clinical-700 transition-colors shadow-sm"
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span>Find a Dentist</span>
                  </Link>
                  <Link
                    to="/patient/appointments"
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Book an Appointment</span>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            /* 3b. Empty State for Dentist */
            <div className="space-y-2 py-2">
              <div className="rounded-lg bg-slate-50 p-4 text-center border border-slate-200">
                <p className="text-xs font-semibold text-slate-700">No scheduled patients found.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Patients with scheduled consultations will appear here automatically.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={!selectedId.trim() || submitting || loadingOptions}
            className="flex items-center gap-1.5"
          >
            <UserCheck className="h-4 w-4" />
            <span>{submitting ? 'Connecting...' : 'Open Chat'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
