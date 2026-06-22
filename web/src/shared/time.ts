/** Small date/time helpers shared across the app. */

/** "Jun 22" — matches the iOS `Date.dayShort`. */
export function dayShort(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "10:30 PM" — matches the iOS `Date.timeHMM`. */
export function timeHMM(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Calendar key "YYYY-MM-DD" in local time. */
export function dayKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Seconds between an absolute label and the session start. */
export function offsetSeconds(
  start: Date | string,
  label: Date | string,
): number {
  const s = typeof start === 'string' ? new Date(start) : start;
  const l = typeof label === 'string' ? new Date(label) : label;
  return Math.max(0, (l.getTime() - s.getTime()) / 1000);
}

/** "mm:ss" or "h:mm:ss" elapsed display. */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return hrs > 0 ? `${hrs}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Round to one decimal place. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
