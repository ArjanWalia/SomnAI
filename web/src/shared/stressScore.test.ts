import { describe, expect, it } from 'vitest';
import {
  StressAccumulator,
  combineCalmness,
  computeStressResult,
} from './stressScore';

describe('combineCalmness', () => {
  it('averages two values', () => {
    expect(combineCalmness(0.8, 0.4)).toBeCloseTo(0.6, 5);
  });
  it('uses the only available value', () => {
    expect(combineCalmness(0.7, null)).toBe(0.7);
    expect(combineCalmness(null, 0.3)).toBe(0.3);
  });
  it('is null when neither model produced a value', () => {
    expect(combineCalmness(null, null)).toBeNull();
  });
});

describe('computeStressResult', () => {
  it('perfectly calm → 100, no stressed moments', () => {
    const acc = new StressAccumulator();
    for (let t = 0; t < 5; t++) acc.push({ t, video: 1, audio: 1 });
    const r = acc.result();
    expect(r.stressScore).toBe(100);
    expect(r.stressedOffsets).toEqual([]);
  });

  it('empty session → 100', () => {
    expect(computeStressResult([]).stressScore).toBe(100);
  });

  it('averages calmness across ticks into the score', () => {
    const acc = new StressAccumulator();
    acc.push({ t: 0, video: 1, audio: 1 }); // 1.0
    acc.push({ t: 1, video: 0, audio: 0 }); // 0.0
    // mean 0.5 → 50
    expect(acc.result().stressScore).toBe(50);
  });

  it('flags a stressed run of 3+ consecutive low samples at its start', () => {
    const acc = new StressAccumulator();
    acc.push({ t: 0, video: 0.9, audio: 0.9 });
    acc.push({ t: 1, video: 0.2, audio: 0.2 });
    acc.push({ t: 2, video: 0.1, audio: 0.1 });
    acc.push({ t: 3, video: 0.2, audio: 0.2 });
    acc.push({ t: 4, video: 0.9, audio: 0.9 });
    expect(acc.result().stressedOffsets).toEqual([1]);
  });

  it('does not flag a brief dip shorter than 3 samples', () => {
    const acc = new StressAccumulator();
    acc.push({ t: 0, video: 0.9, audio: 0.9 });
    acc.push({ t: 1, video: 0.1, audio: 0.1 });
    acc.push({ t: 2, video: 0.1, audio: 0.1 });
    acc.push({ t: 3, video: 0.9, audio: 0.9 });
    expect(acc.result().stressedOffsets).toEqual([]);
  });

  it('records multiple separate stressed runs', () => {
    const samples = [
      { t: 0, calmness: 0.2 },
      { t: 1, calmness: 0.2 },
      { t: 2, calmness: 0.2 },
      { t: 3, calmness: 0.9 },
      { t: 4, calmness: 0.1 },
      { t: 5, calmness: 0.1 },
      { t: 6, calmness: 0.1 },
    ];
    expect(computeStressResult(samples).stressedOffsets).toEqual([0, 4]);
  });

  it('ignores ticks where neither model produced a value', () => {
    const acc = new StressAccumulator();
    acc.push({ t: 0, video: null, audio: null });
    acc.push({ t: 1, video: 0.5, audio: 0.5 });
    expect(acc.count).toBe(1);
  });
});
