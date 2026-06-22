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
import { hashPassword } from '../lib/crypto';

const EMAIL_KEY = 'somnai.user.email';
const MIN_PASSWORD = 6;

interface AuthValue {
  email: string | null;
  isSignedIn: boolean;
  working: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
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

  const authenticate = useCallback(
    async (raw: string, password: string, mode: 'signin' | 'signup') => {
      const value = raw.trim().toLowerCase();
      if (!isValidEmail(value)) {
        setError('Enter a valid email address.');
        return;
      }
      if (password.length < MIN_PASSWORD) {
        setError(`Password must be at least ${MIN_PASSWORD} characters.`);
        return;
      }
      setWorking(true);
      setError(null);
      try {
        const hash = await hashPassword(value, password);
        if (mode === 'signup') await backend().signUp(value, hash);
        else await backend().signIn(value, hash);
        localStorage.setItem(EMAIL_KEY, value);
        setEmail(value);
      } catch (e) {
        // Surface the credential/sync error and stay on the login screen.
        setError(String(e instanceof Error ? e.message : e));
      } finally {
        setWorking(false);
      }
    },
    [],
  );

  const signIn = useCallback(
    (email: string, password: string) => authenticate(email, password, 'signin'),
    [authenticate],
  );
  const signUp = useCallback(
    (email: string, password: string) => authenticate(email, password, 'signup'),
    [authenticate],
  );

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
      signUp,
      signOut,
    }),
    [email, working, error, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
