import { useCallback, useEffect, useState } from 'react';
import { db } from '../lib/db';
import type { SleepSession, StressSession } from '../shared/types';

interface SessionsState {
  sleep: SleepSession[];
  stress: StressSession[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Loads the signed-in user's sleep + stress sessions from the data layer. */
export function useSessions(): SessionsState {
  const [sleep, setSleep] = useState<SleepSession[]>([]);
  const [stress, setStress] = useState<StressSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([db.listSleepSessions(), db.listStressSessions()])
      .then(([s, st]) => {
        if (cancelled) return;
        setSleep(s);
        setStress(st);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load sessions.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { sleep, stress, loading, error, reload };
}
