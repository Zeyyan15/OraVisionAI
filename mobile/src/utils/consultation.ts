import type { ConsultationResponse } from '../types';

export function consultationActions(role: string, status: string, approved = true) {
  return {
    start: role === 'dentist' && approved && status === 'scheduled',
    end: role === 'dentist' && approved && status === 'active',
    cancel: status === 'scheduled' && (role === 'patient' || (role === 'dentist' && approved)),
  };
}

export function elapsedSeconds(session: ConsultationResponse, now = Date.now()) {
  if (session.session_status !== 'active' || !session.started_at) return session.duration_seconds || 0;
  const start = Date.parse(session.started_at);
  return Number.isFinite(start) ? Math.max(0, Math.floor((now - start) / 1000)) : 0;
}

export function formatDuration(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return `${Math.floor(value / 60).toString().padStart(2, '0')}:${(value % 60).toString().padStart(2, '0')}`;
}

export function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
