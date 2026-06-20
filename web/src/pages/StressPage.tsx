import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader } from '../components/Loader';
import { ScoreCircle } from '../components/ScoreCircle';
import { ScoreGraph } from '../components/ScoreGraph';
import { SessionCard } from '../components/SessionCard';
import { buildGraphPoints } from '../lib/graphData';
import { useSessions } from '../hooks/useSessions';

const PAGE = 5;

export default function StressPage() {
  const navigate = useNavigate();
  const { stress, loading, error } = useSessions();
  const [visible, setVisible] = useState(PAGE);

  if (loading) return <Loader label="Loading stress data…" />;
  if (error) return <p className="page page--error">{error}</p>;

  const latest = stress[0] ?? null;
  const points = buildGraphPoints([], stress);

  return (
    <div className="page">
      <div className="circles-row circles-row--center">
        <ScoreCircle score={latest?.stress_score ?? null} caption="latest stress score" />
      </div>

      <button
        type="button"
        className="btn btn--primary btn--block"
        onClick={() => navigate('/stress/record')}
      >
        ● Record new work session
      </button>

      <div className="card">
        <ScoreGraph points={points} />
      </div>

      <h2 className="section-title">Work sessions</h2>
      {stress.length === 0 && <p className="muted">No work sessions yet.</p>}
      <div className="session-list">
        {stress.slice(0, visible).map((s) => (
          <SessionCard
            key={s.id}
            date={s.date}
            start={s.start_ts}
            end={s.end_ts}
            score={s.stress_score}
            onClick={() => navigate(`/stress/${s.id}`)}
          />
        ))}
      </div>
      {visible < stress.length && (
        <button type="button" className="see-more" onClick={() => setVisible((v) => v + PAGE)}>
          See more <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}
