/**
 * Scoring constants shared by the web app and (conceptually) the iOS app.
 * Mirrors SomnAI/SleepScoring.swift and the stress accumulator so a score
 * re-derived on either client matches.
 */

/** Every session starts at a perfect score. */
export const INITIAL_SLEEP_SCORE = 100;

/** The sleep classifier tags fixed 10-second windows. */
export const LABEL_DURATION_SECONDS = 10;

/** Labels are grouped into 60-minute windows for scoring. */
export const LABEL_WINDOW_MINUTES = 60;
export const LABEL_WINDOW_SECONDS = LABEL_WINDOW_MINUTES * 60;

/** Snoring/hypopnea apply once per group of 5 in a window. */
export const GROUP_SIZE = 5;
/** Obstructive apnea applies once per group of 3 in a window. */
export const OBSTRUCTIVE_GROUP_SIZE = 3;

/** Per-category multipliers (see DATA-CONTRACT.md). */
export const WEIGHTS = {
  snoring: 0.995, // when more than 5 in a window
  hypopneaLow: 0.95, // 5–14 in a window
  hypopneaHigh: 0.9, // 15 or more in a window
  obstructive: 0.85, // more than 3 in a window
} as const;

/** Thresholds that must be exceeded for a category to apply. */
export const THRESHOLDS = {
  snoring: 5,
  hypopneaLow: 5,
  hypopneaHigh: 15,
  obstructive: 3,
} as const;

// --- Stress scoring ---

/** Models are sampled once per second while recording. */
export const STRESS_SAMPLE_INTERVAL_MS = 1000;
/** Combined calmness below this counts as a stressed sample. */
export const STRESS_FLAG_THRESHOLD = 0.5;
/** A stressed run needs at least this many consecutive low samples. */
export const STRESS_FLAG_MIN_SAMPLES = 3;
