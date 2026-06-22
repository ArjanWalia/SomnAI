/**
 * Runtime configuration. Everything here ships to the browser, so only a
 * publishable Butterbase token belongs in env. The token may also be pasted in
 * Settings (stored in localStorage); that takes precedence over the env value.
 *
 * When no token is present, the app runs against a localStorage + IndexedDB
 * demo store so it is fully usable without a live backend.
 */

const env = import.meta.env;

const SETTINGS_TOKEN_KEY = 'somnai.butterbase.token';

export const butterbaseConfig = {
  baseUrl: (env.VITE_BUTTERBASE_URL ?? 'https://api.butterbase.ai').replace(/\/$/, ''),
  appId: env.VITE_BUTTERBASE_APP_ID ?? 'app_whop1jqjf6do',
  tables: {
    users: env.VITE_BB_USERS_TABLE ?? 'users',
    sleep: env.VITE_BB_SLEEP_TABLE ?? 'sleep',
    stress: env.VITE_BB_STRESS_TABLE ?? 'stress',
  },
} as const;

/** The Butterbase token, preferring a Settings-provided value over env. */
export function getButterbaseToken(): string {
  try {
    const local = localStorage.getItem(SETTINGS_TOKEN_KEY);
    if (local && local.trim().length > 0) return local.trim();
  } catch {
    /* localStorage unavailable */
  }
  return (env.VITE_BUTTERBASE_TOKEN ?? '').trim();
}

export function setButterbaseToken(token: string): void {
  try {
    if (token.trim().length === 0) localStorage.removeItem(SETTINGS_TOKEN_KEY);
    else localStorage.setItem(SETTINGS_TOKEN_KEY, token.trim());
  } catch {
    /* ignore */
  }
}

/** True when a real Butterbase token is configured (live sync enabled). */
export function isButterbaseConfigured(): boolean {
  return getButterbaseToken().length > 0;
}
