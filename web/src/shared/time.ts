/** Small, dependency-free date/time helpers shared across the app. */

import type { ISODate, ISOInstant } from './types';

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nowISO(): ISOInstant {
  return new Date().toISOString();
}

/** Format an instant as a short local time, e.g. "11:14 PM". */
export function formatClock(ts: ISOInstant | Date): string {
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Format a calendar day, e.g. "June 20th". */
export function formatDayLong(date: ISODate | Date): string {
  const d = typeof date === 'string' ? new Date(`${date}T00:00:00`) : date;
  const month = d.toLocaleDateString(undefined, { month: 'long' });
  const day = d.getDate();
  return `${month} ${day}${ordinal(day)}`;
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

/** Whole-minute:second clock for a duration given in seconds, e.g. "07:32". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return hrs > 0 ? `${hrs}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Seconds between two instants (end - start), never negative. */
export function durationSeconds(start: ISOInstant, end: ISOInstant): number {
  return Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 1000);
}
