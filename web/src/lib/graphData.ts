import type { GraphPoint } from '../components/ScoreGraph';
import type { SleepSession, StressSession } from '../shared/types';

interface Agg {
  sleepSum: number;
  sleepN: number;
  stressSum: number;
  stressN: number;
}

/**
 * Collapse all sessions into one point per day, averaging when a day has more
 * than one score (per the spec's "if more than one score has been recorded in
 * one day" behavior). Sorted oldest → newest for the chart.
 */
export function buildGraphPoints(
  sleep: SleepSession[],
  stress: StressSession[],
): GraphPoint[] {
  const map = new Map<string, Agg>();
  const get = (date: string): Agg => {
    let e = map.get(date);
    if (!e) {
      e = { sleepSum: 0, sleepN: 0, stressSum: 0, stressN: 0 };
      map.set(date, e);
    }
    return e;
  };

  for (const s of sleep) {
    const e = get(s.date);
    e.sleepSum += s.sleep_score;
    e.sleepN += 1;
  }
  for (const s of stress) {
    const e = get(s.date);
    e.stressSum += s.stress_score;
    e.stressN += 1;
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, e]) => ({
      date,
      sleep: e.sleepN ? Math.round((e.sleepSum / e.sleepN) * 10) / 10 : null,
      stress: e.stressN ? Math.round((e.stressSum / e.stressN) * 10) / 10 : null,
    }));
}
