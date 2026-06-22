/** Aggregates sessions into per-day points for the combined score graph. */

import { dayKey, dayShort } from '../shared/time';
import type { SleepSession, StressSession } from '../shared/types';

export interface GraphPoint {
  key: string;
  label: string;
  sleep?: number;
  stress?: number;
}

export function buildGraphPoints(
  sleep: SleepSession[],
  stress: StressSession[],
): GraphPoint[] {
  const byDay = new Map<
    string,
    { sleepSum: number; sleepN: number; stressSum: number; stressN: number }
  >();

  const ensure = (key: string) => {
    let v = byDay.get(key);
    if (!v) {
      v = { sleepSum: 0, sleepN: 0, stressSum: 0, stressN: 0 };
      byDay.set(key, v);
    }
    return v;
  };

  for (const s of sleep) {
    const v = ensure(dayKey(s.start));
    v.sleepSum += s.sleepScore;
    v.sleepN += 1;
  }
  for (const s of stress) {
    const v = ensure(dayKey(s.start));
    v.stressSum += s.stressScore;
    v.stressN += 1;
  }

  return [...byDay.keys()]
    .sort()
    .map((key) => {
      const v = byDay.get(key)!;
      return {
        key,
        label: dayShort(key),
        sleep: v.sleepN ? Math.round(v.sleepSum / v.sleepN) : undefined,
        stress: v.stressN ? Math.round(v.stressSum / v.stressN) : undefined,
      };
    });
}
