import { useMemo, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { ConnectPhonePrompt } from '../components/ConnectPhonePrompt';
import { Loader } from '../components/Loader';
import { ScoreCircle } from '../components/ScoreCircle';
import { ScoreGraph } from '../components/ScoreGraph';
import { SessionCard } from '../components/SessionCard';
import { useSessions } from '../hooks/useSessions';
import { buildGraphPoints } from '../lib/graphData';

const PAGE = 5;

export function SleepPage() {
  const { sleep, stress, loading } = useSessions();
  const [page, setPage] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);
  const points = useMemo(() => buildGraphPoints(sleep, stress), [sleep, stress]);

  const shown = sleep.slice(0, (page + 1) * PAGE);

  return (
    <AppShell tint="sleep">
      {loading ? (
        <Loader />
      ) : (
        <>
          <div className="card tint-sleep center">
            <ScoreCircle score={sleep[0]?.sleepScore ?? null} label="Latest sleep" small />
          </div>

          <button className="btn-sleep btn-full" onClick={() => setShowPrompt((v) => !v)}>
            🌙 Record sleep
          </button>
          {showPrompt && <ConnectPhonePrompt />}

          <div className="card">
            <p className="card-title">Sleep trend</p>
            <ScoreGraph points={points.map((p) => ({ ...p, stress: undefined }))} />
          </div>

          <div className="stack" style={{ gap: 8 }}>
            <p className="card-title" style={{ margin: 0 }}>Past nights</p>
            {shown.length === 0 && <p className="muted">No nights yet — record on your phone.</p>}
            {shown.map((s) => (
              <SessionCard key={s.id} to={`/sleep/${s.id}`} start={s.start} end={s.end} score={s.sleepScore} tint="sleep" />
            ))}
            {shown.length < sleep.length && (
              <button onClick={() => setPage((p) => p + 1)}>Show more</button>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
