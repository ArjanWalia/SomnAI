import { Link } from 'react-router-dom';
import { dayShort, timeHMM } from '../shared/time';
import { scoreColor } from '../lib/format';

interface Props {
  to?: string;
  start: string;
  end: string;
  score?: number;
  tint?: 'sleep' | 'stress';
}

export function SessionCard({ to, start, end, score, tint }: Props) {
  const body = (
    <>
      <div className="row" style={{ gap: 12 }}>
        {tint && <span className="dot" style={{ background: tint === 'sleep' ? '#7399ff' : '#ff8c80' }} />}
        <div className="when">
          <span className="date">{dayShort(start)}</span>
          <span className="range">
            {timeHMM(start)} – {timeHMM(end)}
          </span>
        </div>
      </div>
      {score != null && (
        <span className="score-chip" style={{ color: scoreColor(score) }}>
          {Math.round(score)}
        </span>
      )}
    </>
  );

  return to ? (
    <Link className="session-card" to={to}>
      {body}
    </Link>
  ) : (
    <div className="session-card">{body}</div>
  );
}
