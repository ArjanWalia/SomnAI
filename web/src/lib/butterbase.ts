/**
 * Butterbase Data + Storage API client. Mirrors the iOS app's
 * SomnAI/ButterbaseClient.swift exactly so rows written by either client are
 * readable by the other:
 *
 *   - base https://api.butterbase.ai, app app_kf3crd1822g8
 *   - Authorization: Bearer <token>
 *   - tables reached at /v1/{app}/{table}, filtered with PostgREST-style
 *     ?email=eq.<email>&order=start_timestamp.desc
 *   - storage is a two-step upload: POST /storage/{app}/upload → presigned PUT
 */

import { butterbaseConfig, getButterbaseToken } from './config';
import type { SleepRow, StressRow, UserRow } from '../shared/types';

function tableUrl(table: string, query?: string): string {
  const base = `${butterbaseConfig.baseUrl}/v1/${butterbaseConfig.appId}/${table}`;
  return query ? `${base}?${query}` : base;
}

function authHeaders(extra?: Record<string, string>): HeadersInit {
  const token = getButterbaseToken();
  if (!token) throw new Error('No Butterbase token configured.');
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    // Supabase/PostgREST-style backends expect the key in BOTH headers.
    apikey: token,
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

async function send(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Butterbase HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res;
}

// --- Users ---

export async function upsertUser(email: string): Promise<void> {
  await send(tableUrl(butterbaseConfig.tables.users), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email }),
  });
}

/** Look up a single user row by email, or null if none exists. */
export async function getUser(email: string): Promise<UserRow | null> {
  const query = `email=eq.${encodeURIComponent(email)}&limit=1`;
  const res = await send(tableUrl(butterbaseConfig.tables.users, query), {
    method: 'GET',
    headers: authHeaders(),
  });
  const rows = (await res.json()) as UserRow[];
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

/** Create a new user row with a password hash. Returns the inserted row when
 *  the backend echoes it back (Prefer: return=representation). */
export async function createUser(
  email: string,
  passwordHash: string,
): Promise<UserRow | null> {
  const res = await send(tableUrl(butterbaseConfig.tables.users), {
    method: 'POST',
    headers: authHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify({
      id: crypto.randomUUID(),
      email,
      password_hash: passwordHash,
    }),
  });
  try {
    const json = await res.json();
    const row = Array.isArray(json) ? json[0] : json;
    return (row ?? null) as UserRow | null;
  } catch {
    return null;
  }
}

/** Set/replace the password hash on an existing user row. */
export async function setUserPassword(email: string, passwordHash: string): Promise<void> {
  const query = `email=eq.${encodeURIComponent(email)}`;
  await send(tableUrl(butterbaseConfig.tables.users, query), {
    method: 'PATCH',
    headers: authHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify({ password_hash: passwordHash }),
  });
}

// --- Sleep (read-only from the web app; the phone writes these) ---

export async function fetchSleep(email: string): Promise<SleepRow[]> {
  const query = `email=eq.${encodeURIComponent(email)}&order=start_timestamp.desc`;
  const res = await send(tableUrl(butterbaseConfig.tables.sleep, query), {
    method: 'GET',
    headers: authHeaders(),
  });
  return (await res.json()) as SleepRow[];
}

export async function putSleep(row: SleepRow): Promise<void> {
  await send(tableUrl(butterbaseConfig.tables.sleep), {
    method: 'POST',
    headers: authHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(row),
  });
}

// --- Stress (written by the web app) ---

export async function fetchStress(email: string): Promise<StressRow[]> {
  const query = `email=eq.${encodeURIComponent(email)}&order=start_timestamp.desc`;
  const res = await send(tableUrl(butterbaseConfig.tables.stress, query), {
    method: 'GET',
    headers: authHeaders(),
  });
  return (await res.json()) as StressRow[];
}

export async function putStress(row: StressRow): Promise<void> {
  await send(tableUrl(butterbaseConfig.tables.stress), {
    method: 'POST',
    headers: authHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(row),
  });
}

// --- Storage (two-step upload, matching the iOS client) ---

interface UploadResponse {
  uploadUrl: string;
  objectKey: string;
  objectId: string;
  expiresIn: number;
}

/** Upload a media blob and return its stored object id (audio_id / video_id). */
export async function uploadMedia(
  blob: Blob,
  filename: string,
): Promise<string> {
  const endpoint = `${butterbaseConfig.baseUrl}/storage/${butterbaseConfig.appId}/upload`;
  const res = await send(endpoint, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      filename,
      contentType: blob.type || 'application/octet-stream',
      sizeBytes: blob.size,
      public: false,
    }),
  });
  const meta = (await res.json()) as UploadResponse;
  const put = await fetch(meta.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': blob.type || 'application/octet-stream' },
    body: blob,
  });
  if (!put.ok) throw new Error(`Upload PUT failed: HTTP ${put.status}`);
  return meta.objectId;
}

/** Build a signed/download URL for a stored object. */
export function mediaUrl(objectId: string): string {
  return `${butterbaseConfig.baseUrl}/storage/${butterbaseConfig.appId}/object/${encodeURIComponent(objectId)}`;
}

/** Pings the three tables to verify the token + schema. */
export async function testConnection(): Promise<{
  ok: boolean;
  message: string;
}> {
  if (!getButterbaseToken()) {
    return { ok: false, message: 'No token set. Paste your Butterbase token and save.' };
  }
  const missing: string[] = [];
  let unauthorized = false;
  for (const table of Object.values(butterbaseConfig.tables)) {
    try {
      await send(tableUrl(table, 'limit=1'), { method: 'GET', headers: authHeaders() });
    } catch (e) {
      const msg = String(e);
      if (msg.includes('401') || msg.includes('403')) unauthorized = true;
      else if (msg.includes('404')) missing.push(table);
      else return { ok: false, message: msg };
    }
  }
  if (unauthorized)
    return { ok: false, message: 'Token rejected (401/403). Check the key is valid and not expired.' };
  if (missing.length)
    return {
      ok: false,
      message: `Token works, but these tables are missing: ${missing.join(
        ', ',
      )}. Tap "Create tables" to provision them.`,
    };
  return { ok: true, message: 'Connected. users, sleep and stress are reachable.' };
}

/**
 * Create the users / sleep / stress tables if they don't exist, mirroring the
 * iOS app's POST /v1/{app}/schema/apply. Requires a service key (bb_sk_…) with
 * admin permissions. The column shapes match SomnAI/ButterbaseClient.swift so
 * both clients share the same rows; `users.password_hash` is the web-only
 * addition that powers password sign-in.
 */
export async function provisionSchema(): Promise<{ ok: boolean; message: string }> {
  if (!getButterbaseToken()) {
    return { ok: false, message: 'No token set. Paste your Butterbase token and save first.' };
  }
  const body = {
    name: 'SomnAI bootstrap',
    schema: {
      tables: {
        [butterbaseConfig.tables.users]: {
          primary_key: ['id'],
          columns: {
            id: { type: 'text' },
            email: { type: 'text', nullable: false },
            password_hash: { type: 'text', nullable: true },
            created_at: { type: 'timestamptz', default: 'now()' },
          },
        },
        [butterbaseConfig.tables.sleep]: {
          primary_key: ['id'],
          columns: {
            id: { type: 'text' },
            email: { type: 'text', nullable: false },
            date: { type: 'text' },
            start_timestamp: { type: 'timestamptz' },
            end_timestamp: { type: 'timestamptz' },
            sleep_score: { type: 'numeric' },
            audio_id: { type: 'text', nullable: true },
            hypopnea_timestamps: { type: 'jsonb' },
            obstructive_timestamps: { type: 'jsonb' },
            snoring_timestamps: { type: 'jsonb' },
          },
        },
        [butterbaseConfig.tables.stress]: {
          primary_key: ['id'],
          columns: {
            id: { type: 'text' },
            email: { type: 'text', nullable: false },
            date: { type: 'text' },
            start_timestamp: { type: 'timestamptz' },
            end_timestamp: { type: 'timestamptz' },
            stress_score: { type: 'numeric' },
            video_id: { type: 'text', nullable: true },
            audio_id: { type: 'text', nullable: true },
            stressed_timestamps: { type: 'jsonb' },
          },
        },
      },
    },
  };
  try {
    const endpoint = `${butterbaseConfig.baseUrl}/v1/${butterbaseConfig.appId}/schema/apply`;
    await send(endpoint, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    return { ok: true, message: 'Schema applied. users, sleep and stress tables are ready.' };
  } catch (e) {
    const msg = String(e);
    if (msg.includes('401') || msg.includes('403')) {
      return {
        ok: false,
        message: 'Token rejected. Use a service key (bb_sk_…) with admin permissions to apply schema.',
      };
    }
    return { ok: false, message: `Schema apply failed: ${msg}` };
  }
}
