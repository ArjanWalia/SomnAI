/**
 * Deterministic demo data for the local fallback backend.
 *
 * When there is no live Butterbase, we still want the home graph, "last
 * session" cards and lists to look like the mockups — and to show how
 * phone-recorded sleep data would appear once synced. This generates a week of
 * plausible sleep + stress sessions, with sleep scores derived through the real
 * scoring algorithm so the numbers are internally consistent.
 */

import { computeSleepScore } from '../shared/sleepScore';
import { toISODate } from '../shared/time';
import type { SleepSession, StressSession } from '../shared/types';

// Small seeded PRNG so the demo is stable across reloads.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function spread(rand: () => number, count: number, spanSec: number): number[] {
  return Array.from({ length: count }, () => Math.floor(rand() * spanSec)).sort(
    (a, b) => a - b,
  );
}

export function seedSessions(userId: string): {
  sleep: SleepSession[];
  stress: StressSession[];
} {
  // Derive a stable seed from the user id so each user gets consistent demo data.
  let seed = 0;
  for (const ch of userId) seed = (seed * 31 + ch.charCodeAt(0)) | 0;
  const rand = mulberry32(seed || 12345);
  const sleep: SleepSession[] = [];
  const stress: StressSession[] = [];
  const today = new Date();

  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const day = new Date(today);
    day.setDate(today.getDate() - dayOffset);
    const date = toISODate(day);

    // --- Sleep session (recorded "on the phone") ---
    const start = new Date(day);
    start.setHours(23, Math.floor(rand() * 40), 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 7, start.getMinutes() + Math.floor(rand() * 50));

    const hyp = spread(rand, Math.floor(rand() * 18), 8 * 3600);
    const obs = spread(rand, Math.floor(rand() * 5), 8 * 3600);
    const sno = spread(rand, Math.floor(rand() * 14), 8 * 3600);
    const { score } = computeSleepScore({
      hypopnea_timestamps: hyp,
      obstructive_apnea_timestamps: obs,
      snoring_timestamps: sno,
    });

    sleep.push({
      id: `seed-sleep-${date}`,
      user_id: userId,
      date,
      start_ts: start.toISOString(),
      end_ts: end.toISOString(),
      sleep_score: score,
      audio_id: null, // demo has no real audio bytes
      hypopnea_timestamps: hyp,
      obstructive_apnea_timestamps: obs,
      snoring_timestamps: sno,
    });

    // --- One or two stress (work) sessions per day ---
    const sessionsToday = 1 + (rand() > 0.6 ? 1 : 0);
    for (let s = 0; s < sessionsToday; s++) {
      const wStart = new Date(day);
      wStart.setHours(9 + s * 4, Math.floor(rand() * 50), 0, 0);
      const durMin = 25 + Math.floor(rand() * 60);
      const wEnd = new Date(wStart.getTime() + durMin * 60_000);
      const stressScore = Math.round((45 + rand() * 50) * 10) / 10;
      stress.push({
        id: `seed-stress-${date}-${s}`,
        user_id: userId,
        date,
        start_ts: wStart.toISOString(),
        end_ts: wEnd.toISOString(),
        stress_score: stressScore,
        video_id: null,
        audio_id: null,
        stressed_timestamps: spread(rand, Math.floor(rand() * 6), durMin * 60),
      });
    }
  }

  return { sleep, stress };
}
