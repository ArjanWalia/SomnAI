/**
 * Data-access layer. One interface, two backends:
 *   - butterbaseBackend: live sync with the shared Butterbase tables (used when
 *     a token is configured) — the same rows the iPhone app reads/writes.
 *   - localBackend: localStorage + IndexedDB, seeded with a week of demo data
 *     on first use, so the app is fully usable with no backend.
 */

import * as bb from './butterbase';
import { isButterbaseConfigured } from './config';
import { putBlob } from './idb';
import { seedFor } from './seed';
import { dayShort } from '../shared/time';
import type {
  SleepRow,
  SleepSession,
  StressRow,
  StressSession,
} from '../shared/types';

export interface Backend {
  readonly live: boolean;
  signIn(email: string): Promise<void>;
  listSleep(email: string): Promise<SleepSession[]>;
  listStress(email: string): Promise<StressSession[]>;
  saveStress(
    email: string,
    session: StressSession,
    media?: { video?: Blob; audio?: Blob },
  ): Promise<StressSession>;
}

// --- Row <-> model mapping ---

function sleepFromRow(r: SleepRow): SleepSession {
  return {
    id: r.id,
    start: r.start_timestamp,
    end: r.end_timestamp,
    sleepScore: r.sleep_score,
    audioId: r.audio_id ?? null,
    hypopneaTimestamps: r.hypopnea_timestamps ?? [],
    obstructiveTimestamps: r.obstructive_timestamps ?? [],
    snoringTimestamps: r.snoring_timestamps ?? [],
  };
}

function stressFromRow(r: StressRow): StressSession {
  return {
    id: r.id,
    start: r.start_timestamp,
    end: r.end_timestamp,
    stressScore: r.stress_score,
    videoId: r.video_id ?? null,
    audioId: r.audio_id ?? null,
    stressedTimestamps: r.stressed_timestamps ?? [],
  };
}

function stressToRow(email: string, s: StressSession): StressRow {
  return {
    id: s.id,
    email,
    date: dayShort(s.start),
    start_timestamp: s.start,
    end_timestamp: s.end,
    stress_score: s.stressScore,
    video_id: s.videoId ?? null,
    audio_id: s.audioId ?? null,
    stressed_timestamps: s.stressedTimestamps,
  };
}

// --- Live backend ---

const butterbaseBackend: Backend = {
  live: true,
  async signIn(email) {
    await bb.upsertUser(email);
  },
  async listSleep(email) {
    return (await bb.fetchSleep(email)).map(sleepFromRow);
  },
  async listStress(email) {
    return (await bb.fetchStress(email)).map(stressFromRow);
  },
  async saveStress(email, session, media) {
    const next = { ...session };
    if (media?.video) {
      next.videoId = await bb.uploadMedia(media.video, `stress_${session.id}.webm`);
    }
    if (media?.audio) {
      next.audioId = await bb.uploadMedia(media.audio, `stress_${session.id}_audio.webm`);
    }
    await bb.putStress(stressToRow(email, next));
    return next;
  },
};

// --- Local demo backend ---

const SLEEP_KEY = (email: string) => `somnai.local.sleep.${email}`;
const STRESS_KEY = (email: string) => `somnai.local.stress.${email}`;
const SEEDED_KEY = (email: string) => `somnai.local.seeded.${email}`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

const localBackend: Backend = {
  live: false,
  async signIn(email) {
    if (!localStorage.getItem(SEEDED_KEY(email))) {
      const { sleep, stress } = seedFor(email);
      writeJson(SLEEP_KEY(email), sleep);
      writeJson(STRESS_KEY(email), stress);
      localStorage.setItem(SEEDED_KEY(email), '1');
    }
  },
  async listSleep(email) {
    return readJson<SleepSession[]>(SLEEP_KEY(email), []);
  },
  async listStress(email) {
    return readJson<StressSession[]>(STRESS_KEY(email), []);
  },
  async saveStress(email, session, media) {
    const next = { ...session };
    if (media?.video) {
      next.videoId = `local:video:${session.id}`;
      await putBlob(next.videoId, media.video);
    }
    if (media?.audio) {
      next.audioId = `local:audio:${session.id}`;
      await putBlob(next.audioId, media.audio);
    }
    const all = readJson<StressSession[]>(STRESS_KEY(email), []);
    all.unshift(next);
    writeJson(STRESS_KEY(email), all);
    return next;
  },
};

/** Pick the backend based on whether a Butterbase token is configured. */
export function backend(): Backend {
  return isButterbaseConfigured() ? butterbaseBackend : localBackend;
}
