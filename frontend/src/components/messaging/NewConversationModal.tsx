/**
 * OraVisionAI — New Conversation Initiation Modal (Phase 27)
 *
 * Accessible modal allowing patient/dentist to select an authorized counterpart
 * and initiate/reactivate a direct 1:1 conversation thread.
 */

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { UserRole } from '../../types/domain';
import { ConversationResponse } from '../../types/communication';
import { initiateDentistConversation, initiatePatientConversation } from '../../api/communicationEndpoints';
import { apiClient } from '../../api/client';
import { API_PATHS } from '../../api/endpoints';
import { UserCheck, AlertCircle } from 'lucide-react';

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
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-load authorized eligible counterparts from appointments/consultations
  useEffect(() => {
    if (!isOpen) return;

    if (initialCounterpartId) {
      setSelectedId(initialCounterpartId);
      if (initialCounterpartName) {
        setOptions([{ id: initialCounterpartId, name: initialCounterpartName }]);
      }
    }

    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        if (currentRole === 'patient') {
          // Fetch consultations to discover authorized dentists
          const res = await apiClient.get<{ consultations: Array<{ dentist_id: string; dentist_name?: string | null; clinic_name?: string | null }> }>(
            API_PATHS.CONSULTATIONS,
          );
          const map = new Map<string, CounterpartOption>();
          for (const c of res.consultations || []) {
            if (c.dentist_id && !map.has(c.dentist_id)) {
              map.set(c.dentist_id, {
                id: c.dentist_id,
                name: c.dentist_name || 'Verified Dentist',
                subtext: c.clinic_name || 'Dental Clinic',
              });
            }
          }
          setOptions(Array.from(map.values()));
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
          setOptions(Array.from(map.values()));
        }
      } catch {
        // Silently fall back if list is empty
      } finally {
        setLoadingOptions(false);
      }
    };

    loadOptions();
  }, [isOpen, currentRole, initialCounterpartId]);

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

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
            <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Counterpart Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            {currentRole === 'patient' ? 'Select Dentist' : 'Select Patient'}
          </label>

          {loadingOptions ? (
            <div className="h-10 rounded-lg bg-slate-100 animate-pulse" />
          ) : options.length > 0 ? (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-clinical-500 focus:outline-none focus:ring-1 focus:ring-clinical-500 bg-white"
            >
              <option value="">-- Choose from your treating partners --</option>
              {options.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name} {opt.subtext ? `(${opt.subtext})` : ''}
                </option>
              ))}
            </select>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                placeholder={
                  currentRole === 'patient'
                    ? 'Enter Dentist UUID...'
                    : 'Enter Patient UUID...'
                }
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-clinical-500 focus:outline-none focus:ring-1 focus:ring-clinical-500"
              />
              <p className="text-[11px] text-slate-400">
                Tip: Direct conversations can also be initiated directly from your scheduled appointments list.
              </p>
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
            disabled={!selectedId.trim() || submitting}
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
