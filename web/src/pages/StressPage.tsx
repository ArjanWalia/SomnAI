import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { Loader } from '../components/Loader';
import { ScoreCircle } from '../components/ScoreCircle';
import { ScoreGraph } from '../components/ScoreGraph';
import { SessionCard } from '../components/SessionCard';
import { useSessions } from '../hooks/useSessions';
import { buildGraphPoints } from '../lib/graphData';

const PAGE = 5;

export function StressPage() {
  const { stress, sleep, loading } = useSessions();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const points = useMemo(() => buildGraphPoints(sleep, stress), [sleep, stress]);

  const shown = stress.slice(0, (page + 1) * PAGE);

  return (
    <AppShell tint="stress">
      {loading ? (
        <Loader />
      ) : (
        <>
          <div className="card tint-stress center">
            <ScoreCircle score={stress[0]?.stressScore ?? null} label="Latest calmness" small />
          </div>

          <button className="btn-stress btn-full" onClick={() => navigate('/stress/record')}>
            ● Record a work session
          </button>

          <div className="card">
            <p className="card-title">Stress trend</p>
            <ScoreGraph points={points.map((p) => ({ ...p, sleep: undefined }))} />
          </div>

          <div className="stack" style={{ gap: 8 }}>
            <p className="card-title" style={{ margin: 0 }}>Past sessions</p>
            {shown.length === 0 && <p className="muted">No work sessions yet.</p>}
            {shown.map((s) => (
              <SessionCard key={s.id} to={`/stress/${s.id}`} start={s.start} end={s.end} score={s.stressScore} tint="stress" />
            ))}
            {shown.length < stress.length && (
              <button onClick={() => setPage((p) => p + 1)}>Show more</button>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
