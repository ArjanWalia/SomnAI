/**
 * Minimal Butterbase REST client.
 *
 * Butterbase is an open-source, Supabase-style backend (Postgres data plane with
 * auto-generated REST endpoints, JWT email/password auth, and S3/R2-backed
 * object storage with presigned URLs). This client targets those documented
 * surfaces. Because the precise paths can differ between Butterbase versions,
 * every endpoint is built in one place (`paths` below) so it is trivial to
 * adjust against the live docs without touching call sites.
 *
 * Auth model: requests carry `apikey: <anon>` plus `Authorization: Bearer
 * <token>` where the token is the signed-in user's JWT (falling back to the
 * anon key for anonymous reads). Row-level security on the tables is what
 * actually scopes data to a user.
 */

import { butterbaseConfig } from './config';

export interface BBSession {
  token: string;
  user: { id: string; email: string };
}

export class BBError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'BBError';
  }
}

const base = butterbaseConfig.baseUrl;

/** Centralised endpoint builders — adjust here if the live API differs. */
const paths = {
  signUp: () => `${base}/auth/signup`,
  signIn: () => `${base}/auth/signin`,
  signOut: () => `${base}/auth/signout`,
  currentUser: () => `${base}/auth/user`,
  table: (name: string) => `${base}/auto-api/${name}`,
  storageObject: (bucket: string, key: string) =>
    `${base}/storage/${bucket}/${encodeURIComponent(key)}`,
  storageSignedUrl: (bucket: string, key: string) =>
    `${base}/storage/${bucket}/${encodeURIComponent(key)}/signed-url`,
};

function authHeaders(token?: string): Record<string, string> {
  return {
    apikey: butterbaseConfig.anonKey,
    Authorization: `Bearer ${token ?? butterbaseConfig.anonKey}`,
  };
}

async function parse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request(url: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  const body = await parse(res);
  if (!res.ok) {
    const msg =
      (body && typeof body === 'object' && 'message' in body
        ? String((body as { message: unknown }).message)
        : null) ?? `Request failed (${res.status})`;
    throw new BBError(msg, res.status, body);
  }
  return body;
}

// --- Auth --------------------------------------------------------------------

export const auth = {
  async signUp(email: string, password: string): Promise<BBSession> {
    const body = await request(paths.signUp(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ email, password }),
    });
    return normaliseSession(body, email);
  },

  async signIn(email: string, password: string): Promise<BBSession> {
    const body = await request(paths.signIn(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ email, password }),
    });
    return normaliseSession(body, email);
  },

  async signOut(token: string): Promise<void> {
    await request(paths.signOut(), {
      method: 'POST',
      headers: authHeaders(token),
    }).catch(() => undefined); // best-effort; local session is cleared regardless
  },
};

/** Butterbase returns slightly different envelopes across versions; flatten. */
function normaliseSession(body: unknown, fallbackEmail: string): BBSession {
  const b = (body ?? {}) as Record<string, any>;
  const token: string =
    b.access_token ?? b.token ?? b.session?.access_token ?? b.jwt ?? '';
  const user = b.user ?? b.session?.user ?? {};
  if (!token) throw new BBError('No auth token in response', 200, body);
  return {
    token,
    user: { id: user.id ?? user.sub ?? '', email: user.email ?? fallbackEmail },
  };
}

// --- Table CRUD (PostgREST-style auto-api) -----------------------------------

export type Filter = Record<string, string | number>;

export interface QueryOptions {
  /** Equality filters, e.g. `{ user_id: '…' }`. */
  match?: Filter;
  /** Column to order by. */
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
}

function buildQuery(opts: QueryOptions): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.match ?? {})) {
    // PostgREST-style equality operator.
    params.append(k, `eq.${v}`);
  }
  if (opts.orderBy) {
    params.append('order', `${opts.orderBy}.${opts.ascending ? 'asc' : 'desc'}`);
  }
  if (opts.limit != null) params.append('limit', String(opts.limit));
  const q = params.toString();
  return q ? `?${q}` : '';
}

export function table<Row>(name: string, token?: string) {
  const headers = () => authHeaders(token);
  return {
    async select(opts: QueryOptions = {}): Promise<Row[]> {
      const body = await request(paths.table(name) + buildQuery(opts), {
        method: 'GET',
        headers: headers(),
      });
      return (Array.isArray(body) ? body : body ? [body] : []) as Row[];
    },

    async insert(row: Partial<Row>): Promise<Row> {
      const body = await request(paths.table(name), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Prefer: 'return=representation', ...headers() },
        body: JSON.stringify(row),
      });
      return (Array.isArray(body) ? body[0] : body) as Row;
    },

    async update(match: Filter, patch: Partial<Row>): Promise<void> {
      await request(paths.table(name) + buildQuery({ match }), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers() },
        body: JSON.stringify(patch),
      });
    },
  };
}

// --- Storage -----------------------------------------------------------------

export const storage = {
  /** Upload bytes to `bucket/key`; returns the object key (the stored id). */
  async upload(bucket: string, key: string, blob: Blob, token?: string): Promise<string> {
    await request(paths.storageObject(bucket, key), {
      method: 'PUT',
      headers: {
        'Content-Type': blob.type || 'application/octet-stream',
        ...authHeaders(token),
      },
      body: blob,
    });
    return key;
  },

  /** Get a (presigned) URL to play/download a stored object. */
  async getUrl(bucket: string, key: string, token?: string): Promise<string> {
    const body = (await request(paths.storageSignedUrl(bucket, key), {
      method: 'GET',
      headers: authHeaders(token),
    })) as { url?: string; signedUrl?: string } | null;
    return body?.url ?? body?.signedUrl ?? paths.storageObject(bucket, key);
  },
};
