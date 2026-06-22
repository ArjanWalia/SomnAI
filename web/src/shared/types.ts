/**
 * The cross-client data model. These shapes mirror the Butterbase rows the
 * iOS app reads/writes (SomnAI/ButterbaseClient.swift, SomnAI/Models.swift) so
 * the web app and the phone share the same tables.
 *
 * Note: label timestamp arrays hold ABSOLUTE ISO-8601 instants (matching the
 * iOS `[Date]` encoding), not offsets. Playback seeking derives the offset as
 * (label − session start).
 */

export type ISODateString = string;

export interface User {
  email: string;
}

export type SleepLabelKind =
  | 'snoring'
  | 'hypopnea'
  | 'obstructive_apnea'
  | 'no_apnea';

/** A single classified 10-second window. */
export interface SleepLabel {
  id: string;
  kind: SleepLabelKind;
  /** Absolute instant the window started. */
  start: ISODateString;
  /** Seconds (defaults to the 10s window length). */
  duration: number;
}

export interface SleepSession {
  id: string;
  start: ISODateString;
  end: ISODateString;
  sleepScore: number; // 0–100
  audioId?: string | null;
  /** Stored as the three category arrays on the Butterbase row. */
  hypopneaTimestamps: ISODateString[];
  obstructiveTimestamps: ISODateString[];
  snoringTimestamps: ISODateString[];
}

export interface StressLabel {
  /** Absolute instant the stressed run started. */
  start: ISODateString;
  duration: number;
}

export interface StressSession {
  id: string;
  start: ISODateString;
  end: ISODateString;
  stressScore: number; // 0–100, 100 = perfectly calm
  videoId?: string | null;
  audioId?: string | null;
  stressedTimestamps: ISODateString[];
}

/** The raw Butterbase row shapes (snake_case), used by the live backend. */
export interface SleepRow {
  id: string;
  email: string;
  date: string;
  start_timestamp: ISODateString;
  end_timestamp: ISODateString;
  sleep_score: number;
  audio_id?: string | null;
  hypopnea_timestamps: ISODateString[];
  obstructive_timestamps: ISODateString[];
  snoring_timestamps: ISODateString[];
}

export interface StressRow {
  id: string;
  email: string;
  date: string;
  start_timestamp: ISODateString;
  end_timestamp: ISODateString;
  stress_score: number;
  video_id?: string | null;
  audio_id?: string | null;
  stressed_timestamps: ISODateString[];
}
