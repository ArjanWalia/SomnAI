/**
 * SomnAI shared data model.
 *
 * These types are the cross-platform contract between the iOS app and the web
 * app. Both clients read and write the same Butterbase tables, so the field
 * names here mirror the Butterbase schema exactly (see
 * docs/butterbase-schema.json and docs/DATA-CONTRACT.md). Keep this file and
 * the schema in lock-step.
 */

/** Calendar day in `YYYY-MM-DD` (local to the user when the session started). */
export type ISODate = string;

/** An absolute instant in ISO-8601 / RFC-3339, e.g. `2026-06-20T23:14:05.000Z`. */
export type ISOInstant = string;

/**
 * A label event expressed as an offset, in seconds, from the start of the
 * recording. The classifier tags fixed 10-second windows, so these are the
 * window start offsets. Storing offsets (rather than absolute instants) keeps
 * the arrays small and makes "jump playback to this label" trivial.
 */
export type OffsetSeconds = number;

/** Sleep event categories produced by the on-device sleep classifier. */
export type SleepLabelKind = 'hypopnea' | 'obstructive_apnea' | 'snoring';

/** The single category produced by the web stress pipeline. */
export type StressLabelKind = 'stressed';

export interface User {
  id: string;
  email: string;
  created_at?: ISOInstant;
}

/**
 * One night of sleep. Recorded on the phone; the web app only reads these.
 * `audio_id` references the actual recording stored in the audio bucket — the
 * heavy audio bytes never live in the row itself.
 */
export interface SleepSession {
  id: string;
  user_id: string;
  date: ISODate;
  /** "Timestamp" column — when the recording started. */
  start_ts: ISOInstant;
  /** "End Timestamp" column — when the recording stopped. */
  end_ts: ISOInstant;
  /** 0–100, computed by the sleep-scoring algorithm. */
  sleep_score: number;
  /** Reference into the audio storage bucket (object key). */
  audio_id: string | null;
  hypopnea_timestamps: OffsetSeconds[];
  obstructive_apnea_timestamps: OffsetSeconds[];
  snoring_timestamps: OffsetSeconds[];
}

/**
 * One work session analysed by the web app (computer camera + mic). The video
 * lives in a storage bucket (`video_id`); the audio lives in the more
 * space-efficient audio bucket (`audio_id`).
 */
export interface StressSession {
  id: string;
  user_id: string;
  date: ISODate;
  start_ts: ISOInstant;
  end_ts: ISOInstant;
  /** 0–100. 100 = perfectly calm, 0 = extremely stressed. */
  stress_score: number;
  /** Reference into the video storage bucket (object key). */
  video_id: string | null;
  /** Reference into the audio storage bucket (object key). */
  audio_id: string | null;
  /** Offsets (seconds from start) where the pipeline flagged the user stressed. */
  stressed_timestamps: OffsetSeconds[];
}

/** A label event flattened for the scoring algorithm. */
export interface LabelEvent<K extends string = SleepLabelKind> {
  kind: K;
  /** Start offset of the 10-second window, in seconds from recording start. */
  startSec: OffsetSeconds;
}

/** Rows the app inserts (server fills `id` / `created_at`). */
export type NewSleepSession = Omit<SleepSession, 'id'>;
export type NewStressSession = Omit<StressSession, 'id'>;
