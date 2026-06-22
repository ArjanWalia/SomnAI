/**
 * Deterministic demo data so the app is fully usable without a backend.
 * Sleep scores are REAL (computed with the shared algorithm) so the demo
 * matches what the live app would show for the same labels.
 */

import { scoreSession } from '../shared/sleepScore';
import { computeStressResult } from '../shared/stressScore';
import { dayShort } from '../shared/time';
import type { SleepSession, StressSession } from '../shared/types';

/** Small seeded PRNG (mulberry32) for stable demo data per user. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashEmail(email: string): number {
  let h = 2166136261;
  for (let i = 0; i < email.length; i++) {
    h ^= email.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function uid(prefix: string, rand: () => number): string {
  return `${prefix}-${Math.floor(rand() * 1e9).toString(36)}`;
}

export interface SeedData {
  sleep: SleepSession[];
  stress: StressSession[];
}

export function seedFor(email: string): SeedData {
  const rand = rng(hashEmail(email));
  const sleep: SleepSession[] = [];
  const stress: StressSession[] = [];
  const now = new Date();

  for (let dayBack = 6; dayBack >= 0; dayBack--) {
    const night = new Date(now);
    night.setDate(now.getDate() - dayBack);
    night.setHours(22, Math.floor(rand() * 40), 0, 0);

    const sleepStart = new Date(night);
    const sleepEnd = new Date(night.getTime() + (7 + rand() * 1.5) * 3600 * 1000);

    const hypopnea = Math.floor(rand() * 18);
    const obstructive = Math.floor(rand() * 5);
    const snoring = Math.floor(rand() * 14);

    const spread = (n: number) =>
      Array.from({ length: n }, () => {
        const offset = rand() * (sleepEnd.getTime() - sleepStart.getTime());
        return new Date(sleepStart.getTime() + offset).toISOString();
      }).sort();

    const hypopneaTimestamps = spread(hypopnea);
    const obstructiveTimestamps = spread(obstructive);
    const snoringTimestamps = spread(snoring);

    const session: SleepSession = {
      id: uid('sleep', rand),
      start: sleepStart.toISOString(),
      end: sleepEnd.toISOString(),
      sleepScore: 0,
      audioId: null,
      hypopneaTimestamps,
      obstructiveTimestamps,
      snoringTimestamps,
    };
    session.sleepScore = scoreSession(session);
    sleep.push(session);

    // 1–2 work sessions per day.
    const workCount = 1 + (rand() > 0.5 ? 1 : 0);
    for (let w = 0; w < workCount; w++) {
      const workStart = new Date(now);
      workStart.setDate(now.getDate() - dayBack);
      workStart.setHours(9 + w * 4 + Math.floor(rand() * 2), Math.floor(rand() * 50), 0, 0);
      const durationMin = 25 + Math.floor(rand() * 60);
      const workEnd = new Date(workStart.getTime() + durationMin * 60 * 1000);

      // Synthesize calmness samples to derive a real stress score + flags.
      const ticks = durationMin * 2; // one every 30s for compactness
      const samples: { t: number; calmness: number }[] = [];
      const baseline = 0.5 + rand() * 0.45;
      for (let i = 0; i < ticks; i++) {
        const dip = rand() < 0.12 ? rand() * 0.5 : 0;
        samples.push({ t: i * 30, calmness: Math.max(0, Math.min(1, baseline - dip)) });
      }
      const { stressScore, stressedOffsets } = computeStressResult(samples);

      stress.push({
        id: uid('stress', rand),
        start: workStart.toISOString(),
        end: workEnd.toISOString(),
        stressScore,
        videoId: null,
        audioId: null,
        stressedTimestamps: stressedOffsets.map((o) =>
          new Date(workStart.getTime() + o * 1000).toISOString(),
        ),
      });
    }
  }

  sleep.sort((a, b) => +new Date(b.start) - +new Date(a.start));
  stress.sort((a, b) => +new Date(b.start) - +new Date(a.start));
  return { sleep, stress };
}

/** Used by Claude prompts / cards. */
export function sessionDateLabel(startISO: string): string {
  return dayShort(startISO);
}
