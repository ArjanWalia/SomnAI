/**
 * Runtime configuration, read from Vite env vars (see .env.example).
 *
 * Everything here ships to the browser, so only the *publishable* Butterbase
 * key belongs in it. If the anon key is absent the app runs against a
 * localStorage-backed fallback store (see lib/localStore.ts) so it is fully
 * usable for development and demos without a live backend.
 */

const env = import.meta.env;

export const butterbaseConfig = {
  baseUrl: (env.VITE_BUTTERBASE_URL ?? 'https://api.butterbase.ai/v1/app_kf3crd1822g8').replace(
    /\/$/,
    '',
  ),
  anonKey: env.VITE_BUTTERBASE_ANON_KEY ?? '',
  tables: {
    users: env.VITE_BB_USERS_TABLE ?? 'users',
    sleep: env.VITE_BB_SLEEP_TABLE ?? 'sleep_sessions',
    stress: env.VITE_BB_STRESS_TABLE ?? 'stress_sessions',
  },
  buckets: {
    video: env.VITE_BB_VIDEO_BUCKET ?? 'stress-video',
    audio: env.VITE_BB_AUDIO_BUCKET ?? 'session-audio',
  },
} as const;

/** True when a real Butterbase key is configured. */
export const isButterbaseConfigured = butterbaseConfig.anonKey.length > 0;
