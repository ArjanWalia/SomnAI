/**
 * Stress (web) scoring.
 *
 * Two models each emit a calmness score in [0,1] (0 = extremely stressed,
 * 1 = perfectly calm). The session's stress score is their average × 100, so
 * 100 = perfectly calm and 0 = extremely stressed.
 *
 * `StressAccumulator` folds the live per-tick samples into a running score and
 * records the offsets where the user was flagged stressed, so the detail view
 * can jump the video/audio to "the exact times when stress was labeled".
 */

import {
  STRESS_FLAG_MIN_SAMPLES,
  STRESS_FLAG_THRESHOLD,
} from './constants';

export interface CalmnessSample {
  /** Offset in seconds from the start of the recording. */
  t: number;
  /** Video-model calmness 0–1, or null if the model produced nothing this tick. */
  video: number | null;
  /** Audio-model calmness 0–1, or null if the model produced nothing this tick. */
  audio: number | null;
}

/** Average the two model outputs, ignoring whichever is missing. Null if both. */
export function combineCalmness(
  video: number | null,
  audio: number | null,
): number | null {
  const parts = [video, audio].filter((v): v is number => v != null);
  if (parts.length === 0) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

export class StressAccumulator {
  private calmSum = 0;
  private calmCount = 0;
  private lowRun = 0;
  private runStart: number | null = null;
  private readonly flagged: number[] = [];
  private lastCalmness: number | null = null;

  /** Feed one sample. Returns the combined calmness for this tick (or null). */
  push(sample: CalmnessSample): number | null {
    const calm = combineCalmness(sample.video, sample.audio);
    if (calm == null) return null;

    this.lastCalmness = calm;
    this.calmSum += calm;
    this.calmCount += 1;

    if (calm < STRESS_FLAG_THRESHOLD) {
      if (this.lowRun === 0) this.runStart = sample.t;
      this.lowRun += 1;
      // Record the run's start exactly once, when it first qualifies.
      if (this.lowRun === STRESS_FLAG_MIN_SAMPLES && this.runStart != null) {
        this.flagged.push(Math.round(this.runStart));
      }
    } else {
      this.lowRun = 0;
      this.runStart = null;
    }
    return calm;
  }

  /** Mean calmness across all samples, 0–1 (1 if nothing seen yet). */
  get averageCalmness(): number {
    return this.calmCount === 0 ? 1 : this.calmSum / this.calmCount;
  }

  /** Session stress score, 0–100 (100 = calm). */
  get stressScore(): number {
    return Math.round(this.averageCalmness * 100 * 10) / 10;
  }

  /** Most recent combined calmness, for the live gauge. */
  get currentCalmness(): number | null {
    return this.lastCalmness;
  }

  /** Offsets (seconds) where a sustained stressed run began. */
  get stressedTimestamps(): number[] {
    return [...this.flagged];
  }

  get sampleCount(): number {
    return this.calmCount;
  }
}
