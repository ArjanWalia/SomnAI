import { useMemo } from 'react';
import { AppShell } from '../components/AppShell';
import { Loader } from '../components/Loader';
import { ScoreCircle } from '../components/ScoreCircle';
import { ScoreGraph } from '../components/ScoreGraph';
import { SessionCard } from '../components/SessionCard';
import { useSessions } from '../hooks/useSessions';
import { buildGraphPoints } from '../lib/graphData';

export function HomePage() {
  const { sleep, stress, loading } = useSessions();
  const points = useMemo(() => buildGraphPoints(sleep, stress), [sleep, stress]);

  const latestStress = stress[0]?.stressScore ?? null;
  const latestSleep = sleep[0]?.sleepScore ?? null;

  return (
    <AppShell tint="home">
      {loading ? (
        <Loader label="Loading your sessions…" />
      ) : (
        <>
          <div className="card">
            <div className="orbs">
              <ScoreCircle score={latestStress} label="Latest stress" />
              <ScoreCircle score={latestSleep} label="Latest sleep" />
            </div>
          </div>

          {stress[0] && (
            <div className="stack" style={{ gap: 8 }}>
              <p className="card-title" style={{ margin: 0 }}>Last work session</p>
              <SessionCard
                to={`/stress/${stress[0].id}`}
                start={stress[0].start}
                end={stress[0].end}
                score={stress[0].stressScore}
                tint="stress"
              />
            </div>
          )}

          {sleep[0] && (
            <div className="stack" style={{ gap: 8 }}>
              <p className="card-title" style={{ margin: 0 }}>Last sleep session</p>
              <SessionCard
                to={`/sleep/${sleep[0].id}`}
                start={sleep[0].start}
                end={sleep[0].end}
                score={sleep[0].sleepScore}
                tint="sleep"
              />
            </div>
          )}

          <div className="card">
            <p className="card-title">Stress &amp; sleep</p>
            <ScoreGraph points={points} />
          </div>
        </>
      )}
    </AppShell>
  );
}
