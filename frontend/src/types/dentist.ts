/**
 * OraVisionAI — Dentist, Appointment & Assessment Domain Types
 *
 * Derived strictly from the frozen Phase 21 backend Pydantic schemas:
 * - app/schemas/dentist.py
 * - app/schemas/appointment.py
 * - app/schemas/dentist_assessment.py
 */

import { DentistVerificationStatus } from './domain';

// ============================================================================
// 1. Dentist Profile & Verification
// ============================================================================

export interface DentistProfile {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string | null;
  avatar_url?: string | null;
  license_number: string;
  specialization: string;
  clinic_name?: string | null;
  clinic_address?: string | null;
  years_of_experience: number;
  bio?: string | null;
  verification_status: DentistVerificationStatus;
  verified_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DentistProfileUpdate {
  specialization?: string;
  clinic_name?: string | null;
  clinic_address?: string | null;
  years_of_experience?: number;
  bio?: string | null;
  first_name?: string;
  last_name?: string;
  phone_number?: string | null;
  avatar_url?: string | null;
}

export interface DentistVerification {
  id: string;
  dentist_id: string;
  document_type: string;
  document_url: string;
  file_name: string;
  file_size_bytes?: number | null;
  status: DentistVerificationStatus;
  submitted_at: string;
  reviewed_at?: string | null;
  review_notes?: string | null;
}

export interface DentistVerificationCreate {
  document_type: string;
  document_url: string;
  file_name: string;
  file_size_bytes?: number | null;
}

// ============================================================================
// 2. Appointment Lifecycle & Scheduling
// ============================================================================

export type AppointmentStatus =
  | 'requested'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'rescheduled'
  | 'no_show';

export type AppointmentType =
  | 'video_teleconsultation'
  | 'audio_teleconsultation'
  | 'in_person_consultation'
  | 'follow_up';

export interface Appointment {
  id: string;
  patient_id: string;
  dentist_id: string;
  screening_id?: string | null;
  scheduled_start: string;
  scheduled_end: string;
  appointment_type: AppointmentType | string;
  status: AppointmentStatus | string;
  cancellation_reason?: string | null;
  cancelled_by_id?: string | null;
  patient_notes?: string | null;
  dentist_notes?: string | null;
  created_at: string;
  updated_at: string;
  patient_name?: string | null;
  dentist_name?: string | null;
  clinic_name?: string | null;
}

export interface AppointmentListResponse {
  items: Appointment[];
  total: number;
}

export interface AppointmentStatusUpdate {
  status: AppointmentStatus;
  dentist_notes?: string | null;
}

export interface AppointmentCancel {
  cancellation_reason: string;
}

// ============================================================================
// 3. Clinical Assessment & Screening Evaluation
// ============================================================================

export interface DentistAssessment {
  id: string;
  screening_id: string;
  dentist_id: string;
  clinical_observations: string;
  diagnosis_notes: string;
  treatment_recommendation: string;
  referral_needed: boolean;
  referral_specialty?: string | null;
  is_finalized: boolean;
  finalized_at?: string | null;
  created_at: string;
  updated_at: string;
  dentist_name?: string | null;
  dentist_clinic?: string | null;
  dentist_license?: string | null;
}

export interface DentistAssessmentCreate {
  clinical_observations: string;
  diagnosis_notes: string;
  treatment_recommendation: string;
  referral_needed?: boolean;
  referral_specialty?: string | null;
  is_finalized?: boolean;
}

export interface DentistAssessmentUpdate {
  clinical_observations?: string;
  diagnosis_notes?: string;
  treatment_recommendation?: string;
  referral_needed?: boolean;
  referral_specialty?: string | null;
  is_finalized?: boolean;
}
