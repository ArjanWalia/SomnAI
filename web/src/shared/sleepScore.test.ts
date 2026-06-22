import { describe, expect, it } from 'vitest';
import {
  computeSleepScore,
  computeSleepScoreFromLabels,
  scoreSession,
  type ScorableLabel,
} from './sleepScore';

const MIN = 60; // seconds

function labels(spec: Array<[ScorableLabel['kind'], number]>): ScorableLabel[] {
  return spec.map(([kind, startSeconds], i) => ({
    id: `${kind}-${i}`,
    kind,
    startSeconds,
  }));
}

describe('computeSleepScore', () => {
  it('is 100 when there are no labels', () => {
    expect(computeSleepScoreFromLabels([])).toBe(100);
  });

  it('is 100 with only no_apnea labels', () => {
    expect(
      computeSleepScoreFromLabels(
        labels([
          ['no_apnea', 0],
          ['no_apnea', 600],
        ]),
      ),
    ).toBe(100);
  });

  it('spec example: 5 hypopnea within one hour → 95', () => {
    expect(
      computeSleepScore({
        hypopnea_timestamps: [0, 60, 120, 180, 240],
        obstructive_apnea_timestamps: [],
        snoring_timestamps: [],
      }),
    ).toBe(95);
  });

  it('fewer than 5 hypopnea does not degrade', () => {
    expect(
      computeSleepScore({
        hypopnea_timestamps: [0, 60, 120, 180],
        obstructive_apnea_timestamps: [],
        snoring_timestamps: [],
      }),
    ).toBe(100);
  });

  it('15+ hypopnea in an hour uses the steeper 0.90 band, per group of 5', () => {
    const ts = Array.from({ length: 15 }, (_, i) => i * 120); // 15 within 30 min
    const score = computeSleepScore({
      hypopnea_timestamps: ts,
      obstructive_apnea_timestamps: [],
      snoring_timestamps: [],
    });
    // groups = floor(15/5) = 3 → 100 * 0.9^3 = 72.9
    expect(score).toBeCloseTo(72.9, 5);
  });

  it('snoring only degrades above 5, gently', () => {
    const ts = Array.from({ length: 6 }, (_, i) => i * 60);
    const score = computeSleepScore({
      hypopnea_timestamps: [],
      obstructive_apnea_timestamps: [],
      snoring_timestamps: ts,
    });
    // groups = max(1, floor(6/5)) = 1 → 100 * 0.995 = 99.5
    expect(score).toBe(99.5);
  });

  it('more than 3 obstructive apnea → 0.85 per group of 3', () => {
    const ts = Array.from({ length: 4 }, (_, i) => i * 120);
    const score = computeSleepScore({
      hypopnea_timestamps: [],
      obstructive_apnea_timestamps: ts,
      snoring_timestamps: [],
    });
    // groups = max(1, floor(4/3)) = 1 → 100 * 0.85 = 85
    expect(score).toBe(85);
  });

  it('separate hours each apply their own window multiplier', () => {
    const hour1 = [0, 60, 120, 180, 240]; // 5 hypopnea
    const hour2 = [70 * MIN, 71 * MIN, 72 * MIN, 73 * MIN, 74 * MIN]; // 5 more, next hour
    const score = computeSleepScore({
      hypopnea_timestamps: [...hour1, ...hour2],
      obstructive_apnea_timestamps: [],
      snoring_timestamps: [],
    });
    // two windows → 100 * 0.95 * 0.95 = 90.25, rounded to 1dp
    expect(score).toBe(90.3);
  });

  it('scores a session built from absolute ISO timestamps', () => {
    const start = '2026-06-22T22:00:00.000Z';
    const at = (sec: number) =>
      new Date(new Date(start).getTime() + sec * 1000).toISOString();
    const score = scoreSession({
      start,
      hypopneaTimestamps: [0, 60, 120, 180, 240].map(at),
      obstructiveTimestamps: [],
      snoringTimestamps: [],
    });
    expect(score).toBe(95);
  });
});
