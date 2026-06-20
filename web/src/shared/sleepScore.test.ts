import { describe, expect, it } from 'vitest';
import { computeSleepScore } from './sleepScore';
import { computeScoringWindows, weightForCount } from './labelAlgorithm';
import type { LabelEvent } from './types';

const MIN = 60; // seconds per minute — labels are spaced within the hour

/** Build N labels of one kind spaced 30s apart starting at `from` seconds. */
function spread(count: number, from = 0, step = 30): number[] {
  return Array.from({ length: count }, (_, i) => from + i * step);
}

describe('weightForCount', () => {
  it('matches the spec bands', () => {
    // snoring: more than 5 -> 0.995
    expect(weightForCount('snoring', 5)).toBe(1);
    expect(weightForCount('snoring', 6)).toBe(0.995);
    // hypopnea: 5–14 -> 0.95, 15+ -> 0.90
    expect(weightForCount('hypopnea', 4)).toBe(1);
    expect(weightForCount('hypopnea', 5)).toBe(0.95);
    expect(weightForCount('hypopnea', 14)).toBe(0.95);
    expect(weightForCount('hypopnea', 15)).toBe(0.9);
    expect(weightForCount('hypopnea', 30)).toBe(0.9);
    // obstructive apnea: more than 3 -> 0.85
    expect(weightForCount('obstructive_apnea', 3)).toBe(1);
    expect(weightForCount('obstructive_apnea', 4)).toBe(0.85);
  });
});

describe('computeSleepScore', () => {
  it('is 100 with no labels', () => {
    expect(
      computeSleepScore({
        hypopnea_timestamps: [],
        obstructive_apnea_timestamps: [],
        snoring_timestamps: [],
      }).score,
    ).toBe(100);
  });

  it('matches the spec example: 5 hypopnea in an hour -> 95', () => {
    const res = computeSleepScore({
      hypopnea_timestamps: spread(5, 0, 60),
      obstructive_apnea_timestamps: [],
      snoring_timestamps: [],
    });
    expect(res.score).toBe(95);
  });

  it('does not degrade below the hypopnea threshold', () => {
    const res = computeSleepScore({
      hypopnea_timestamps: spread(4, 0, 60),
      obstructive_apnea_timestamps: [],
      snoring_timestamps: [],
    });
    expect(res.score).toBe(100);
  });

  it('compounds an extra group of five within the same hour', () => {
    // 10 hypopnea in one hour -> 2 groups of 5 -> 100 * 0.95^2 = 90.25
    const res = computeSleepScore({
      hypopnea_timestamps: spread(10, 0, 5 * MIN),
      obstructive_apnea_timestamps: [],
      snoring_timestamps: [],
    });
    expect(res.rawScore).toBeCloseTo(100 * 0.95 ** 2, 6);
    expect(res.score).toBe(90.3);
  });

  it('applies obstructive apnea once even without a full group of five', () => {
    // 4 obstructive apnea (">3") -> 0.85 applied once -> 85
    const res = computeSleepScore({
      hypopnea_timestamps: [],
      obstructive_apnea_timestamps: spread(4, 0, 5 * MIN),
      snoring_timestamps: [],
    });
    expect(res.score).toBe(85);
  });

  it('combines categories multiplicatively', () => {
    // 5 hypopnea (0.95) and 4 obstructive apnea (0.85) in the same hour.
    const res = computeSleepScore({
      hypopnea_timestamps: spread(5, 0, 2 * MIN),
      obstructive_apnea_timestamps: spread(4, MIN, 2 * MIN),
      snoring_timestamps: [],
    });
    expect(res.rawScore).toBeCloseTo(100 * 0.95 * 0.85, 6);
  });

  it('separates labels more than an hour apart into different windows', () => {
    // 5 hypopnea in hour 1 and 5 more in hour 3 -> 0.95 applied twice (two windows).
    const res = computeSleepScore({
      hypopnea_timestamps: [...spread(5, 0, 60), ...spread(5, 3 * 3600, 60)],
      obstructive_apnea_timestamps: [],
      snoring_timestamps: [],
    });
    expect(res.rawScore).toBeCloseTo(100 * 0.95 * 0.95, 6);
  });
});

describe('computeScoringWindows', () => {
  it('anchors a window at the first label and stores start + 60m', () => {
    const labels: LabelEvent[] = spread(6, 120, 60).map((s) => ({
      kind: 'snoring',
      startSec: s,
    }));
    const [w] = computeScoringWindows(labels);
    expect(w.kind).toBe('snoring');
    expect(w.startSec).toBe(120);
    expect(w.endSec).toBe(120 + 3600);
    expect(w.sameCategoryCount).toBe(6);
    expect(w.weight).toBe(0.995);
  });
});
