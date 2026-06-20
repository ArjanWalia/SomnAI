/**
 * Sleep score = 100 degraded by each scoring window's multiplier.
 *
 * This mirrors what the iOS app computes when it finishes a recording. The web
 * app uses it to (a) display the score and (b) re-derive it from stored label
 * timestamps when needed, guaranteeing both platforms agree.
 */

import { INITIAL_SLEEP_SCORE } from './constants';
import {
  computeScoringWindows,
  flattenSleepLabels,
  type ScoringWindow,
} from './labelAlgorithm';
import type { OffsetSeconds, SleepLabelKind } from './types';

export interface SleepScoreResult {
  /** Final score, 0–100, rounded to one decimal. */
  score: number;
  /** Raw (unrounded) score, useful for chaining/tests. */
  rawScore: number;
  /** The windows that contributed, for display ("why is my score 87?"). */
  windows: ScoringWindow[];
}

export interface SleepLabelInput {
  hypopnea_timestamps: OffsetSeconds[];
  obstructive_apnea_timestamps: OffsetSeconds[];
  snoring_timestamps: OffsetSeconds[];
}

/** Compute a sleep score from the three label-offset arrays. */
export function computeSleepScore(input: SleepLabelInput): SleepScoreResult {
  const labels = flattenSleepLabels(input);
  const windows = computeScoringWindows(labels);

  const rawScore = windows.reduce(
    (score, w) => score * w.multiplier,
    INITIAL_SLEEP_SCORE,
  );

  return {
    score: Math.round(rawScore * 10) / 10,
    rawScore,
    windows,
  };
}

/** Total label count per category — handy for summaries and the UI. */
export function countLabels(input: SleepLabelInput): Record<SleepLabelKind, number> {
  return {
    hypopnea: input.hypopnea_timestamps.length,
    obstructive_apnea: input.obstructive_apnea_timestamps.length,
    snoring: input.snoring_timestamps.length,
  };
}
