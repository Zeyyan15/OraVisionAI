/**
 * OraVisionAI — Safe Action URL Resolver (Phase 27)
 *
 * Defensively parses and sanitizes server-provided `action_url` strings
 * and resolves them to validated internal React Router routes per role.
 *
 * Security Invariants:
 * - Strictly rejects external schemes (http://, https://, javascript:, data:)
 * - Strictly rejects protocol-relative URLs (//) and path traversals (../)
 * - Restricts navigation to known, authenticated internal paths
 * - Fallbacks to role dashboard if target is invalid, malformed, or unauthorized
 */

import { UserRole } from '../types/domain';

const UUID_REGEX = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const SCREENING_REGEX = new RegExp(`^/screenings/(${UUID_REGEX})$`);
const CONVERSATION_REGEX = new RegExp(`^/conversations/(${UUID_REGEX})$`);
const APPOINTMENT_REGEX = new RegExp(`^/appointments/(${UUID_REGEX})$`);

export function getRoleDashboard(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'dentist':
      return '/dentist/dashboard';
    case 'patient':
    default:
      return '/patient/dashboard';
  }
}

/**
 * Resolves a server action_url to a safe, role-appropriate client path.
 */
export function resolveSafeActionUrl(
  actionUrl: string | null | undefined,
  role: UserRole,
): string {
  const fallback = getRoleDashboard(role);

  if (!actionUrl || typeof actionUrl !== 'string') {
    return fallback;
  }

  const trimmed = actionUrl.trim();

  // 1. Open-redirect & protocol smuggling defense
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.includes('\\') ||
    trimmed.includes('..')
  ) {
    return fallback;
  }

  // 2. Ensure leading slash
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  // 3. Match known route patterns and map per role
  // A. Screening Session
  const screeningMatch = path.match(SCREENING_REGEX);
  if (screeningMatch) {
    const screeningId = screeningMatch[1];
    if (role === 'patient') {
      return `/patient/screenings/${screeningId}`;
    }
    if (role === 'dentist') {
      return `/dentist/screenings/${screeningId}/review`;
    }
    if (role === 'admin') {
      return '/admin/analytics/screenings';
    }
  }

  // B. Direct Conversation
  const conversationMatch = path.match(CONVERSATION_REGEX);
  if (conversationMatch) {
    const conversationId = conversationMatch[1];
    if (role === 'patient') {
      return `/patient/messages/${conversationId}`;
    }
    if (role === 'dentist') {
      return `/dentist/messages/${conversationId}`;
    }
    if (role === 'admin') {
      // Admins are not messaging participants; direct to audit logs
      return '/admin/audit-logs';
    }
  }

  // C. Appointment / Telehealth
  const appointmentMatch = path.match(APPOINTMENT_REGEX);
  if (appointmentMatch) {
    if (role === 'patient') {
      return '/patient/consultations';
    }
    if (role === 'dentist') {
      return '/dentist/appointments';
    }
    if (role === 'admin') {
      return '/admin/analytics/telehealth';
    }
  }

  // Unsupported or unrecognized internal path -> fallback
  return fallback;
}
