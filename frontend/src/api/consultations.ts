/**
 * OraVisionAI — Consultation API Callers (Phase 25)
 *
 * Implements 7 consultation operations across the 6 canonical backend paths:
 * 1. POST  /api/appointments/{id}/consultation
 * 2. GET   /api/appointments/{id}/consultation
 * 3. GET   /api/consultations
 * 4. GET   /api/consultations/{id}
 * 5. PATCH /api/consultations/{id}/start
 * 6. PATCH /api/consultations/{id}/end
 * 7. PATCH /api/consultations/{id}/fail
 */

import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';
import {
  ConsultationResponse,
  ConsultationCreate,
  ConsultationEnd,
  ConsultationListResponse,
} from '../types/consultation';

export const createConsultationForAppointment = async (
  appointmentId: string,
  payload?: ConsultationCreate
): Promise<ConsultationResponse> => {
  return apiClient.post<ConsultationResponse>(
    ENDPOINTS.APPOINTMENT_CONSULTATION(appointmentId),
    payload || { consultation_type: 'video' }
  );
};

export const getConsultationForAppointment = async (
  appointmentId: string
): Promise<ConsultationResponse> => {
  return apiClient.get<ConsultationResponse>(
    ENDPOINTS.APPOINTMENT_CONSULTATION(appointmentId)
  );
};

export const listConsultations = async (status?: string): Promise<ConsultationListResponse> => {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiClient.get<ConsultationListResponse>(`${ENDPOINTS.CONSULTATIONS}${query}`);
};

export const getConsultation = async (consultationId: string): Promise<ConsultationResponse> => {
  return apiClient.get<ConsultationResponse>(
    ENDPOINTS.CONSULTATION_DETAIL(consultationId)
  );
};

export const startConsultation = async (
  consultationId: string
): Promise<ConsultationResponse> => {
  return apiClient.patch<ConsultationResponse>(
    ENDPOINTS.CONSULTATION_START(consultationId),
    {}
  );
};

export const endConsultation = async (
  consultationId: string,
  payload?: ConsultationEnd
): Promise<ConsultationResponse> => {
  return apiClient.patch<ConsultationResponse>(
    ENDPOINTS.CONSULTATION_END(consultationId),
    payload || {}
  );
};

export const failConsultation = async (
  consultationId: string
): Promise<ConsultationResponse> => {
  return apiClient.patch<ConsultationResponse>(
    ENDPOINTS.CONSULTATION_FAIL(consultationId),
    {}
  );
};
