/**
 * App data layer. The UI talks only to this module; it hides whether data lives
 * in Butterbase (when configured) or a local fallback (localStorage + IndexedDB
 * for media), so the app is fully usable in either mode and the two stay in
 * lock-step on the data shape.
 */

import {
  auth as bbAuth,
  storage as bbStorage,
  table as bbTable,
} from './butterbase';
import { butterbaseConfig, isButterbaseConfigured } from './config';
import { getBlob, putBlob } from './idb';
import { seedSessions } from './seed';
import type {
  NewStressSession,
  SleepSession,
  StressSession,
  User,
} from '../shared/types';

export interface Session {
  token: string;
  user: User;
}

export type MediaBucket = 'video' | 'audio';

const SESSION_KEY = 'somnai.session';

// --- Session persistence -----------------------------------------------------

let current: Session | null = loadSession();

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function setSession(s: Session | null) {
  current = s;
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
}

export function getSession(): Session | null {
  return current;
}

function requireUserId(): string {
  if (!current) throw new Error('Not signed in');
  return current.user.id;
}

// --- Backend interface -------------------------------------------------------

interface Backend {
  signUp(email: string, password: string): Promise<Session>;
  signIn(email: string, password: string): Promise<Session>;
  signOut(): Promise<void>;
  listSleep(userId: string): Promise<SleepSession[]>;
  listStress(userId: string): Promise<StressSession[]>;
  createStress(row: NewStressSession): Promise<StressSession>;
  uploadMedia(bucket: MediaBucket, key: string, blob: Blob): Promise<string>;
  mediaUrl(bucket: MediaBucket, id: string): Promise<string | null>;
}

// --- Butterbase backend ------------------------------------------------------

const butterbaseBackend: Backend = {
  async signUp(email, password) {
    const s = await bbAuth.signUp(email, password);
    // Spec: the email is stored in a Butterbase table.
    await bbTable<User>(butterbaseConfig.tables.users, s.token)
      .insert({ id: s.user.id, email })
      .catch(() => undefined); // ignore if a trigger already created the row
    return s;
  },
  signIn: (email, password) => bbAuth.signIn(email, password),
  async signOut() {
    if (current) await bbAuth.signOut(current.token);
  },
  listSleep: (userId) =>
    bbTable<SleepSession>(butterbaseConfig.tables.sleep, current?.token).select({
      match: { user_id: userId },
      orderBy: 'start_ts',
      ascending: false,
    }),
  listStress: (userId) =>
    bbTable<StressSession>(butterbaseConfig.tables.stress, current?.token).select({
      match: { user_id: userId },
      orderBy: 'start_ts',
      ascending: false,
    }),
  createStress: (row) =>
    bbTable<StressSession>(butterbaseConfig.tables.stress, current?.token).insert(row),
  uploadMedia: (bucket, key, blob) =>
    bbStorage.upload(butterbaseConfig.buckets[bucket], key, blob, current?.token),
  mediaUrl: (bucket, id) =>
    bbStorage.getUrl(butterbaseConfig.buckets[bucket], id, current?.token),
};

// --- Local fallback backend --------------------------------------------------

interface LocalUser {
  id: string;
  email: string;
  password: string;
}

const lsKey = {
  users: 'somnai.local.users',
  sleep: (u: string) => `somnai.local.sleep.${u}`,
  stress: (u: string) => `somnai.local.stress.${u}`,
};

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function ensureSeed(userId: string) {
  if (localStorage.getItem(lsKey.sleep(userId)) == null) {
    const { sleep, stress } = seedSessions(userId);
    writeJSON(lsKey.sleep(userId), sleep);
    writeJSON(lsKey.stress(userId), stress);
  }
}

const localBackend: Backend = {
  async signUp(email, password) {
    const users = readJSON<LocalUser[]>(lsKey.users, []);
    if (users.some((u) => u.email === email)) {
      throw new Error('An account with that email already exists.');
    }
    const user: LocalUser = { id: crypto.randomUUID(), email, password };
    writeJSON(lsKey.users, [...users, user]);
    ensureSeed(user.id);
    return { token: `local.${user.id}`, user: { id: user.id, email } };
  },
  async signIn(email, password) {
    const users = readJSON<LocalUser[]>(lsKey.users, []);
    const user = users.find((u) => u.email === email);
    if (!user || user.password !== password) {
      throw new Error('Invalid email or password.');
    }
    ensureSeed(user.id);
    return { token: `local.${user.id}`, user: { id: user.id, email } };
  },
  async signOut() {
    /* nothing to revoke locally */
  },
  async listSleep(userId) {
    ensureSeed(userId);
    return readJSON<SleepSession[]>(lsKey.sleep(userId), []);
  },
  async listStress(userId) {
    ensureSeed(userId);
    return readJSON<StressSession[]>(lsKey.stress(userId), []);
  },
  async createStress(row) {
    const session: StressSession = { ...row, id: crypto.randomUUID() };
    const list = readJSON<StressSession[]>(lsKey.stress(row.user_id), []);
    writeJSON(lsKey.stress(row.user_id), [session, ...list]);
    return session;
  },
  async uploadMedia(_bucket, key, blob) {
    await putBlob(key, blob);
    return key;
  },
  async mediaUrl(_bucket, id) {
    const blob = await getBlob(id);
    return blob ? URL.createObjectURL(blob) : null;
  },
};

const backend: Backend = isButterbaseConfigured ? butterbaseBackend : localBackend;

/** Whether the app is running against live Butterbase or the local fallback. */
export const usingLiveBackend = isButterbaseConfigured;

// --- Public API --------------------------------------------------------------

export const db = {
  usingLiveBackend,

  async signUp(email: string, password: string): Promise<Session> {
    const s = await backend.signUp(email, password);
    setSession(s);
    return s;
  },

  async signIn(email: string, password: string): Promise<Session> {
    const s = await backend.signIn(email, password);
    setSession(s);
    return s;
  },

  async signOut(): Promise<void> {
    await backend.signOut().catch(() => undefined);
    setSession(null);
  },

  getSession,

  listSleepSessions: () => backend.listSleep(requireUserId()),
  listStressSessions: () => backend.listStress(requireUserId()),

  async getSleepSession(id: string): Promise<SleepSession | null> {
    const all = await backend.listSleep(requireUserId());
    return all.find((s) => s.id === id) ?? null;
  },
  async getStressSession(id: string): Promise<StressSession | null> {
    const all = await backend.listStress(requireUserId());
    return all.find((s) => s.id === id) ?? null;
  },

  createStressSession: (row: NewStressSession) => backend.createStress(row),
  uploadMedia: (bucket: MediaBucket, key: string, blob: Blob) =>
    backend.uploadMedia(bucket, key, blob),
  getMediaUrl: (bucket: MediaBucket, id: string) => backend.mediaUrl(bucket, id),
};
