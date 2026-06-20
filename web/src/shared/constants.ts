/**
 * Scoring constants — the single source of truth for both clients.
 *
 * The sleep-score rules come straight from the product spec:
 *   - >5 snoring events within 1 hour          -> x0.995
 *   - 5–14 hypopnea labels within 1 hour       -> x0.95
 *   - >=15 hypopnea labels within 1 hour       -> x0.90
 *   - >3 obstructive apnea events within 1 hour -> x0.85
 *   - weights apply "for every group of 5 labels that are present".
 *
 * Tune the thresholds/weights here and both the algorithm and its tests follow.
 */

import type { SleepLabelKind } from './types';

/** Sleep score before any degradation. */
export const INITIAL_SLEEP_SCORE = 100;

/** The classifier tags fixed 10-second windows. */
export const LABEL_DURATION_SECONDS = 10;

/** Each detected window is examined against everything in the next hour. */
export const LABEL_WINDOW_MINUTES = 60;
export const LABEL_WINDOW_SECONDS = LABEL_WINDOW_MINUTES * 60;

/**
 * A weight is applied once per "group" of this many same-category labels found
 * inside a window (the spec's "for every group of 5 labels that are present").
 */
export const GROUP_SIZE = 5;

/** A single degradation rule for one sleep-label category. */
export interface DegradationRule {
  /** Inclusive lower bound on the same-category count inside the window. */
  minCount: number;
  /** Inclusive upper bound (use Infinity for open-ended). */
  maxCount: number;
  /** Multiplier applied to the score (per group of GROUP_SIZE). */
  weight: number;
}

/**
 * Ordered rules per category. The first matching band wins. A category absent
 * here (or a count below every band) means "no degradation" (weight 1).
 */
export const DEGRADATION_RULES: Record<SleepLabelKind, DegradationRule[]> = {
  snoring: [{ minCount: 6, maxCount: Infinity, weight: 0.995 }], // "more than 5"
  hypopnea: [
    { minCount: 5, maxCount: 14, weight: 0.95 },
    { minCount: 15, maxCount: Infinity, weight: 0.9 }, // "more than 15" -> >=15
  ],
  obstructive_apnea: [{ minCount: 4, maxCount: Infinity, weight: 0.85 }], // "more than 3"
};

/** Human-readable names for each sleep label category. */
export const SLEEP_LABEL_NAMES: Record<SleepLabelKind, string> = {
  hypopnea: 'Hypopnea',
  obstructive_apnea: 'Obstructive Apnea',
  snoring: 'Snoring',
};

// --- Stress (web) pipeline ---------------------------------------------------

/** Calmness at/above this is "calm"; below it a moment is flagged "stressed". */
export const STRESS_FLAG_THRESHOLD = 0.5;

/** How often the live stress pipeline samples calmness, in milliseconds. */
export const STRESS_SAMPLE_INTERVAL_MS = 1000;

/** Consecutive low samples required before a stressed window is recorded. */
export const STRESS_FLAG_MIN_SAMPLES = 3;
