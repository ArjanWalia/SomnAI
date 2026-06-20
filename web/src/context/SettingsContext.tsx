import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const API_KEY_STORAGE = 'somnai.claudeApiKey';

interface SettingsContextValue {
  /** The user's Claude API key (stored only in this browser). */
  apiKey: string;
  hasApiKey: boolean;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [apiKey, setKey] = useState<string>(
    () => localStorage.getItem(API_KEY_STORAGE) ?? '',
  );

  const setApiKey = useCallback((key: string) => {
    const trimmed = key.trim();
    setKey(trimmed);
    if (trimmed) localStorage.setItem(API_KEY_STORAGE, trimmed);
    else localStorage.removeItem(API_KEY_STORAGE);
  }, []);

  const clearApiKey = useCallback(() => setApiKey(''), [setApiKey]);

  const value = useMemo<SettingsContextValue>(
    () => ({ apiKey, hasApiKey: apiKey.length > 0, setApiKey, clearApiKey }),
    [apiKey, setApiKey, clearApiKey],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
