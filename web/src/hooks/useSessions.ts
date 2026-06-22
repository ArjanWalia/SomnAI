/** Loads the signed-in user's sleep + stress sessions from the active backend. */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { backend } from '../lib/db';
import type { SleepSession, StressSession } from '../shared/types';

export interface SessionsState {
  sleep: SleepSession[];
  stress: StressSession[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useSessions(): SessionsState {
  const { email } = useAuth();
  const [sleep, setSleep] = useState<SleepSession[]>([]);
  const [stress, setStress] = useState<StressSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const be = backend();
    Promise.all([be.listSleep(email), be.listStress(email)])
      .then(([sl, st]) => {
        if (cancelled) return;
        setSleep(sl);
        setStress(st);
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [email, nonce]);

  return { sleep, stress, loading, error, reload };
}
