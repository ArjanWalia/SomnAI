/**
 * Stress scoring. Two on-device models (video + audio) each emit a calmness
 * value in [0,1] per ~1s tick (0 = extremely stressed, 1 = perfectly calm).
 *
 *   - per tick: calmness = average of whichever model(s) produced a value
 *   - stress_score = round(mean(calmness) × 100, 1dp)  → 100 = perfectly calm
 *   - a moment is flagged "stressed" when combined calmness stays below 0.5
 *     for at least 3 consecutive samples; the run's start offset is recorded.
 */

import {
  STRESS_FLAG_MIN_SAMPLES,
  STRESS_FLAG_THRESHOLD,
} from './constants';
import { round1 } from './time';

export interface StressSample {
  /** Seconds from session start. */
  t: number;
  /** Video-model calmness in [0,1], or null when no face was visible. */
  video: number | null;
  /** Audio-model calmness in [0,1], or null when the model was unavailable. */
  audio: number | null;
}

export interface StressResult {
  /** 0–100, 100 = perfectly calm. */
  stressScore: number;
  /** Start offsets (seconds) of each stressed run. */
  stressedOffsets: number[];
}

/** Combine two optional calmness values into one tick value, or null. */
export function combineCalmness(
  video: number | null,
  audio: number | null,
): number | null {
  const vals = [video, audio].filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export class StressAccumulator {
  private samples: { t: number; calmness: number }[] = [];

  push(sample: StressSample): void {
    const calmness = combineCalmness(sample.video, sample.audio);
    if (calmness == null) return;
    this.samples.push({ t: sample.t, calmness });
  }

  get count(): number {
    return this.samples.length;
  }

  /** Latest combined calmness, for a live gauge. */
  get latest(): number | null {
    const last = this.samples[this.samples.length - 1];
    return last ? last.calmness : null;
  }

  result(): StressResult {
    return computeStressResult(this.samples);
  }
}

export function computeStressResult(
  samples: { t: number; calmness: number }[],
): StressResult {
  if (samples.length === 0) {
    return { stressScore: 100, stressedOffsets: [] };
  }

  const mean =
    samples.reduce((a, s) => a + s.calmness, 0) / samples.length;
  const stressScore = clamp(round1(mean * 100));

  const stressedOffsets: number[] = [];
  let runStart: number | null = null;
  let runLength = 0;
  let recorded = false;

  for (const s of samples) {
    if (s.calmness < STRESS_FLAG_THRESHOLD) {
      if (runStart == null) {
        runStart = s.t;
        runLength = 1;
        recorded = false;
      } else {
        runLength += 1;
      }
      if (runLength >= STRESS_FLAG_MIN_SAMPLES && !recorded && runStart != null) {
        stressedOffsets.push(runStart);
        recorded = true;
      }
    } else {
      runStart = null;
      runLength = 0;
      recorded = false;
    }
  }

  return { stressScore, stressedOffsets };
}

function clamp(score: number): number {
  return Math.max(0, Math.min(100, score));
}
