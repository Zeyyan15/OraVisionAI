/**
 * OraVisionAI — Consultation Domain Types (Phase 25)
 *
 * Strictly derived from the frozen Phase 14/15/21 backend schemas.
 * Represents teleconsultation lifecycle states, request payloads,
 * and consultation response shapes.
 */

import { ConsultationStatus } from './domain';

export type { ConsultationStatus };
export type ConsultationType = 'video' | 'audio' | 'chat';

export interface ConsultationResponse {
  id: string;
  appointment_id: string;
  patient_id: string;
  dentist_id: string;
  stream_call_id: string;
  stream_channel_id?: string | null;
  consultation_type: ConsultationType;
  session_status: ConsultationStatus;
  started_at?: string | null;
  ended_at?: string | null;
  duration_seconds: number;
  clinical_summary?: string | null;
  created_at: string;
  updated_at: string;
  patient_name?: string | null;
  dentist_name?: string | null;
  clinic_name?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
}

export interface ConsultationCreate {
  consultation_type?: ConsultationType;
}

export type ConsultationStart = Record<string, never>;

export interface ConsultationEnd {
  clinical_summary?: string | null;
}

export type ConsultationFail = Record<string, never>;

export interface ConsultationListResponse {
  consultations: ConsultationResponse[];
  total: number;
}
