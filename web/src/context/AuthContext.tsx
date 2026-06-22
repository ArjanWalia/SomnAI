/**
 * Auth = the user's email (the cross-client identity, mirroring the iOS
 * AuthManager). Signing in upserts the email into Butterbase's users table (or
 * seeds the local demo store) and keeps it in localStorage for next time.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { backend } from '../lib/db';

const EMAIL_KEY = 'somnai.user.email';

interface AuthValue {
  email: string | null;
  isSignedIn: boolean;
  working: boolean;
  error: string | null;
  signIn: (email: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

function isValidEmail(email: string): boolean {
  return email.includes('@') && email.includes('.') && email.length >= 5;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(
    () => localStorage.getItem(EMAIL_KEY),
  );
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async (raw: string) => {
    const value = raw.trim().toLowerCase();
    if (!isValidEmail(value)) {
      setError('Enter a valid email address.');
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await backend().signIn(value);
      localStorage.setItem(EMAIL_KEY, value);
      setEmail(value);
    } catch (e) {
      // Best-effort: keep the user signed in locally even if the network failed,
      // matching the iOS behavior.
      localStorage.setItem(EMAIL_KEY, value);
      setEmail(value);
      setError(`Signed in, but sync failed: ${String(e)}`);
    } finally {
      setWorking(false);
    }
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(EMAIL_KEY);
    setEmail(null);
    setError(null);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      email,
      isSignedIn: email != null,
      working,
      error,
      signIn,
      signOut,
    }),
    [email, working, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
