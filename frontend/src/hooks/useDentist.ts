/**
 * OraVisionAI — useDentist Custom Reactive Hook (Phase 24)
 *
 * Coordinates dentist profile state, credential verification lifecycle,
 * and the clinical appointments queue.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getMyDentistProfile,
  updateMyDentistProfile,
  getMyVerificationStatus,
  submitMyVerification,
  listAppointments,
  updateAppointmentStatus,
  cancelAppointment,
} from '../api/dentistEndpoints';
import {
  DentistProfile,
  DentistProfileUpdate,
  DentistVerification,
  DentistVerificationCreate,
  Appointment,
  AppointmentStatusUpdate,
  AppointmentCancel,
} from '../types/dentist';

export function useDentist() {
  const [profile, setProfile] = useState<DentistProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [verification, setVerification] = useState<DentistVerification | null>(null);
  const [verificationLoading, setVerificationLoading] = useState<boolean>(false);
  const [submittingVerification, setSubmittingVerification] = useState<boolean>(false);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState<boolean>(false);
  const [appointmentsTotal, setAppointmentsTotal] = useState<number>(0);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);

  // Fetch dentist profile
  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const data = await getMyDentistProfile();
      setProfile(data);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load dentist profile';
      setProfileError(errorMsg);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // Update dentist profile
  const updateProfile = useCallback(async (updateData: DentistProfileUpdate): Promise<DentistProfile> => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const updated = await updateMyDentistProfile(updateData);
      setProfile(updated);
      return updated;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update dentist profile';
      setProfileError(errorMsg);
      throw err;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // Fetch verification status
  const fetchVerification = useCallback(async () => {
    setVerificationLoading(true);
    try {
      const data = await getMyVerificationStatus();
      setVerification(data);
    } catch {
      // 404 is normal if no verification document has been submitted yet
      setVerification(null);
    } finally {
      setVerificationLoading(false);
    }
  }, []);

  // Submit verification metadata
  const submitVerification = useCallback(
    async (createData: DentistVerificationCreate): Promise<DentistVerification> => {
      setSubmittingVerification(true);
      try {
        const result = await submitMyVerification(createData);
        setVerification(result);
        await fetchProfile(); // Refresh profile verification_status
        return result;
      } catch (err: unknown) {
        throw err;
      } finally {
        setSubmittingVerification(false);
      }
    },
    [fetchProfile],
  );

  // Fetch appointments list
  const fetchAppointments = useCallback(async (statusFilter?: string) => {
    setAppointmentsLoading(true);
    setAppointmentsError(null);
    try {
      const res = await listAppointments(statusFilter);
      setAppointments(res.items);
      setAppointmentsTotal(res.total);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load appointments';
      setAppointmentsError(errorMsg);
    } finally {
      setAppointmentsLoading(false);
    }
  }, []);

  // Update appointment status
  const updateStatus = useCallback(
    async (appointmentId: string, statusData: AppointmentStatusUpdate): Promise<Appointment> => {
      const updated = await updateAppointmentStatus(appointmentId, statusData);
      setAppointments((prev) =>
        prev.map((item) => (item.id === appointmentId ? updated : item)),
      );
      return updated;
    },
    [],
  );

  // Cancel appointment
  const cancelAppt = useCallback(
    async (appointmentId: string, cancelData: AppointmentCancel): Promise<Appointment> => {
      const cancelled = await cancelAppointment(appointmentId, cancelData);
      setAppointments((prev) =>
        prev.map((item) => (item.id === appointmentId ? cancelled : item)),
      );
      return cancelled;
    },
    [],
  );

  useEffect(() => {
    fetchProfile();
    fetchVerification();
  }, [fetchProfile, fetchVerification]);

  const isApproved = profile?.verification_status === 'approved';
  const isPending = profile?.verification_status === 'pending';
  const isRejected = profile?.verification_status === 'rejected';

  return {
    profile,
    profileLoading,
    profileError,
    fetchProfile,
    updateProfile,

    verification,
    verificationLoading,
    submittingVerification,
    fetchVerification,
    submitVerification,

    appointments,
    appointmentsLoading,
    appointmentsTotal,
    appointmentsError,
    fetchAppointments,
    updateStatus,
    cancelAppt,

    isApproved,
    isPending,
    isRejected,
  };
}
