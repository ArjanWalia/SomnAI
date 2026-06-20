import { describe, expect, it } from 'vitest';
import { StressAccumulator, combineCalmness } from './stressScore';

describe('combineCalmness', () => {
  it('averages both models', () => {
    expect(combineCalmness(0.8, 0.4)).toBeCloseTo(0.6);
  });
  it('falls back to whichever model is present', () => {
    expect(combineCalmness(0.7, null)).toBe(0.7);
    expect(combineCalmness(null, 0.3)).toBe(0.3);
  });
  it('is null when both models are missing', () => {
    expect(combineCalmness(null, null)).toBeNull();
  });
});

describe('StressAccumulator', () => {
  it('scores a perfectly calm session at 100', () => {
    const acc = new StressAccumulator();
    for (let t = 0; t < 10; t++) acc.push({ t, video: 1, audio: 1 });
    expect(acc.stressScore).toBe(100);
    expect(acc.stressedTimestamps).toEqual([]);
  });

  it('averages calmness across ticks and scales to 0–100', () => {
    const acc = new StressAccumulator();
    acc.push({ t: 0, video: 1, audio: 1 }); // 1.0
    acc.push({ t: 1, video: 0, audio: 0 }); // 0.0
    expect(acc.stressScore).toBe(50);
  });

  it('flags a sustained stressed run once, at its start', () => {
    const acc = new StressAccumulator();
    acc.push({ t: 0, video: 0.9, audio: 0.9 });
    // three consecutive low samples -> one flag at the run start (t=1)
    acc.push({ t: 1, video: 0.2, audio: 0.2 });
    acc.push({ t: 2, video: 0.1, audio: 0.1 });
    acc.push({ t: 3, video: 0.2, audio: 0.2 });
    acc.push({ t: 4, video: 0.9, audio: 0.9 }); // recovers
    expect(acc.stressedTimestamps).toEqual([1]);
  });

  it('does not flag brief dips below the threshold', () => {
    const acc = new StressAccumulator();
    acc.push({ t: 0, video: 0.2, audio: 0.2 }); // only one low sample
    acc.push({ t: 1, video: 0.9, audio: 0.9 });
    expect(acc.stressedTimestamps).toEqual([]);
  });
});
