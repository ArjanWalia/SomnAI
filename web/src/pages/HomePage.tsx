import { useNavigate } from 'react-router-dom';
import { Loader } from '../components/Loader';
import { ScoreCircle } from '../components/ScoreCircle';
import { ScoreGraph } from '../components/ScoreGraph';
import { SessionCard } from '../components/SessionCard';
import { buildGraphPoints } from '../lib/graphData';
import { useSessions } from '../hooks/useSessions';

export default function HomePage() {
  const navigate = useNavigate();
  const { sleep, stress, loading, error } = useSessions();

  if (loading) return <Loader label="Loading your dashboard…" />;
  if (error) return <p className="page page--error">{error}</p>;

  const lastSleep = sleep[0] ?? null;
  const lastStress = stress[0] ?? null;
  const points = buildGraphPoints(sleep, stress);

  return (
    <div className="page">
      <div className="circles-row">
        <ScoreCircle score={lastStress?.stress_score ?? null} caption="latest stress score" />
        <ScoreCircle score={lastSleep?.sleep_score ?? null} caption="latest sleep score" />
      </div>

      <h2 className="section-title">Your last work session</h2>
      {lastStress ? (
        <SessionCard
          date={lastStress.date}
          start={lastStress.start_ts}
          end={lastStress.end_ts}
          score={lastStress.stress_score}
          onClick={() => navigate(`/stress/${lastStress.id}`)}
        />
      ) : (
        <EmptyCard label="No work sessions yet" cta="Record one" onClick={() => navigate('/stress/record')} />
      )}

      <h2 className="section-title">Your last sleep session</h2>
      {lastSleep ? (
        <SessionCard
          date={lastSleep.date}
          start={lastSleep.start_ts}
          end={lastSleep.end_ts}
          score={lastSleep.sleep_score}
          onClick={() => navigate(`/sleep/${lastSleep.id}`)}
        />
      ) : (
        <EmptyCard label="No sleep sessions yet" cta="How to record" onClick={() => navigate('/sleep')} />
      )}

      <h2 className="section-title">Stress and sleep graph</h2>
      <div className="card">
        <ScoreGraph points={points} />
      </div>
    </div>
  );
}

function EmptyCard({ label, cta, onClick }: { label: string; cta: string; onClick: () => void }) {
  return (
    <div className="session-card session-card--empty">
      <span className="session-card__text muted">{label}</span>
      <button type="button" className="btn btn--ghost btn--sm" onClick={onClick}>
        {cta}
      </button>
    </div>
  );
}
