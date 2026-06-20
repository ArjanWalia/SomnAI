import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConnectPhonePrompt } from '../components/ConnectPhonePrompt';
import { Loader } from '../components/Loader';
import { ScoreCircle } from '../components/ScoreCircle';
import { ScoreGraph } from '../components/ScoreGraph';
import { SessionCard } from '../components/SessionCard';
import { buildGraphPoints } from '../lib/graphData';
import { useSessions } from '../hooks/useSessions';

const PAGE = 5;

export default function SleepPage() {
  const navigate = useNavigate();
  const { sleep, loading, error } = useSessions();
  const [visible, setVisible] = useState(PAGE);
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);

  if (loading) return <Loader label="Loading sleep data…" />;
  if (error) return <p className="page page--error">{error}</p>;

  const latest = sleep[0] ?? null;
  const points = buildGraphPoints(sleep, []);

  return (
    <div className="page">
      <div className="circles-row circles-row--center">
        <ScoreCircle score={latest?.sleep_score ?? null} caption="latest sleep score" />
      </div>

      <button
        type="button"
        className="btn btn--primary btn--block"
        onClick={() => setShowPhonePrompt((v) => !v)}
      >
        ● Record a new sleep session
      </button>
      {showPhonePrompt && (
        <ConnectPhonePrompt
          feature="Recording sleep"
          detail="Sleep is captured by your iPhone's microphone overnight. Open the SomnAI app on your phone to start a recording — your score and labels will appear here automatically."
        />
      )}

      <div className="card">
        <ScoreGraph points={points} />
      </div>

      <h2 className="section-title">Sleep sessions</h2>
      {sleep.length === 0 && <p className="muted">No sleep sessions synced yet.</p>}
      <div className="session-list">
        {sleep.slice(0, visible).map((s) => (
          <SessionCard
            key={s.id}
            date={s.date}
            start={s.start_ts}
            end={s.end_ts}
            score={s.sleep_score}
            onClick={() => navigate(`/sleep/${s.id}`)}
          />
        ))}
      </div>
      {visible < sleep.length && (
        <button type="button" className="see-more" onClick={() => setVisible((v) => v + PAGE)}>
          See more <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}
