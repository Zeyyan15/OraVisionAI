/**
 * OraVisionAI — Appointment Datetime Presentation Utilities
 *
 * Canonical Rule:
 * DATABASE = UTC
 * API CONTRACT = UTC
 * FRONTEND APPOINTMENT PRESENTATION = EXPLICIT UTC
 *
 * All appointment instants are formatted strictly with `{ timeZone: 'UTC' }`
 * to prevent client-local browser timezone shifts (such as PKT +5 or BST +1).
 */

function parseDate(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats appointment date as "Sep 16, 2026" in UTC.
 */
export function formatAppointmentDate(isoStr: string | Date | null | undefined): string {
  const d = parseDate(isoStr);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats appointment calendar day number as "16" in UTC.
 */
export function formatAppointmentDay(isoStr: string | Date | null | undefined): string {
  const d = parseDate(isoStr);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    day: 'numeric',
  });
}

/**
 * Formats appointment calendar month abbreviation as "SEP" in UTC.
 */
export function formatAppointmentMonth(isoStr: string | Date | null | undefined): string {
  const d = parseDate(isoStr);
  if (!d) return '—';
  return d
    .toLocaleDateString('en-US', {
      timeZone: 'UTC',
      month: 'short',
    })
    .toUpperCase();
}

/**
 * Formats appointment time as "09:00 UTC" in 24-hour UTC format.
 */
export function formatAppointmentTime(isoStr: string | Date | null | undefined): string {
  const d = parseDate(isoStr);
  if (!d) return '—';
  const timeStr = d.toLocaleTimeString('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${timeStr} UTC`;
}

/**
 * Formats appointment time range as "09:00 – 09:30 UTC".
 */
export function formatAppointmentTimeRange(
  startIso: string | Date | null | undefined,
  endIso: string | Date | null | undefined,
): string {
  const start = parseDate(startIso);
  const end = parseDate(endIso);
  if (!start) return '—';

  const startTime = start.toLocaleTimeString('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  if (!end) {
    return `${startTime} UTC`;
  }

  const endTime = end.toLocaleTimeString('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `${startTime} – ${endTime} UTC`;
}

/**
 * Formats appointment full datetime as "Sep 16, 2026 09:00 UTC".
 */
export function formatAppointmentDateTime(isoStr: string | Date | null | undefined): string {
  const d = parseDate(isoStr);
  if (!d) return '—';
  const dateStr = d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = d.toLocaleTimeString('en-GB', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${dateStr} ${timeStr} UTC`;
}

