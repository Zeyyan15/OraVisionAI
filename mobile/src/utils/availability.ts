import type { DentistAvailability } from '../types';
export type Slot = { start: string; end: string };
export function availableSlots(windows: DentistAvailability[], date: string, now = Date.now()): Slot[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const day = new Date(`${date}T00:00:00Z`); if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0,10) !== date) return [];
  const slots = new Map<string, Slot>();
  for (const window of windows) {
    if (!window.is_active || window.day_of_week !== day.getUTCDay() || window.slot_duration_minutes <= 0) continue;
    const start = Date.parse(`${date}T${window.start_time}Z`); const end = Date.parse(`${date}T${window.end_time}Z`); const duration = window.slot_duration_minutes * 60000;
    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(duration)) continue;
    for (let time = start; time + duration <= end; time += duration) if (time > now) { const value = { start: new Date(time).toISOString(), end: new Date(time + duration).toISOString() }; slots.set(value.start, value); }
  }
  return [...slots.values()].sort((a,b) => a.start.localeCompare(b.start));
}
