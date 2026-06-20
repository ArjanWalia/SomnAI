import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { db, type Session } from '../lib/db';
import type { User } from '../shared/types';

interface AuthContextValue {
  user: User | null;
  usingLiveBackend: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => db.getSession());

  const signIn = useCallback(async (email: string, password: string) => {
    setSession(await db.signIn(email, password));
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setSession(await db.signUp(email, password));
  }, []);

  const signOut = useCallback(async () => {
    await db.signOut();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      usingLiveBackend: db.usingLiveBackend,
      signIn,
      signUp,
      signOut,
    }),
    [session, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
