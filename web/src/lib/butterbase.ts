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
import type { SleepRow, StressRow } from '../shared/types';

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
      message: `Token works, but these tables are missing: ${missing.join(', ')}. Create them in the Butterbase dashboard.`,
    };
  return { ok: true, message: 'Connected. users, sleep and stress are reachable.' };
}
