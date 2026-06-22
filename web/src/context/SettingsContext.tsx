/**
 * Browser-only settings: the user's Anthropic (Claude) API key and the
 * Butterbase token. Both live in localStorage and never leave the device
 * except as direct API calls to Anthropic / Butterbase.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getButterbaseToken,
  isButterbaseConfigured,
  setButterbaseToken as persistToken,
} from '../lib/config';

const CLAUDE_KEY = 'somnai.claude.key';

interface SettingsValue {
  claudeKey: string;
  setClaudeKey: (key: string) => void;
  butterbaseToken: string;
  setButterbaseToken: (token: string) => void;
  liveBackend: boolean;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [claudeKey, setClaudeKeyState] = useState(
    () => localStorage.getItem(CLAUDE_KEY) ?? '',
  );
  const [token, setTokenState] = useState(() => getButterbaseToken());

  const setClaudeKey = useCallback((key: string) => {
    setClaudeKeyState(key);
    if (key.trim()) localStorage.setItem(CLAUDE_KEY, key.trim());
    else localStorage.removeItem(CLAUDE_KEY);
  }, []);

  const setButterbaseToken = useCallback((next: string) => {
    persistToken(next);
    setTokenState(next.trim());
  }, []);

  const value = useMemo<SettingsValue>(
    () => ({
      claudeKey,
      setClaudeKey,
      butterbaseToken: token,
      setButterbaseToken,
      liveBackend: isButterbaseConfigured(),
    }),
    [claudeKey, setClaudeKey, token, setButterbaseToken],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
