import { formatDayLong } from '../shared/time';
import type { ISODate } from '../shared/types';

export interface GraphPoint {
  date: ISODate;
  sleep?: number | null;
  stress?: number | null;
}

const W = 320;
const H = 190;
const PAD = { left: 30, right: 14, top: 14, bottom: 34 };

const SLEEP_COLOR = '#6c8cff';
const STRESS_COLOR = '#f5a25d';

/** Dual-line chart of sleep + stress scores over dates (Home "Stress and Sleep graph"). */
export function ScoreGraph({ points }: { points: GraphPoint[] }) {
  if (points.length === 0) {
    return <div className="graph-empty">No scores yet — record a session to see your trend.</div>;
  }

  const n = points.length;
  const x = (i: number) =>
    n === 1 ? W / 2 : PAD.left + (i / (n - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    PAD.top + (1 - Math.max(0, Math.min(100, v)) / 100) * (H - PAD.top - PAD.bottom);

  const line = (key: 'sleep' | 'stress') => {
    const pts = points
      .map((p, i) => ({ i, v: p[key] }))
      .filter((p): p is { i: number; v: number } => p.v != null);
    if (pts.length === 0) return null;
    return pts.map((p) => `${x(p.i)},${y(p.v)}`).join(' ');
  };

  const sleepLine = line('sleep');
  const stressLine = line('stress');

  // Show at most 4 date ticks so labels don't overlap.
  const tickEvery = Math.max(1, Math.ceil(n / 4));

  return (
    <div className="graph">
      <div className="graph__legend">
        <span className="graph__legend-item">
          <span className="graph__swatch" style={{ background: STRESS_COLOR }} /> Stress
        </span>
        <span className="graph__legend-item">
          <span className="graph__swatch" style={{ background: SLEEP_COLOR }} /> Sleep
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="graph__svg" role="img" aria-label="Sleep and stress scores over time">
        {/* axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="#33406a" />
        <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="#33406a" />
        {[0, 50, 100].map((v) => (
          <text key={v} x={PAD.left - 6} y={y(v) + 3} textAnchor="end" className="graph__axis-label">
            {v}
          </text>
        ))}

        {stressLine && (
          <polyline points={stressLine} fill="none" stroke={STRESS_COLOR} strokeWidth="2.2" strokeLinejoin="round" />
        )}
        {sleepLine && (
          <polyline points={sleepLine} fill="none" stroke={SLEEP_COLOR} strokeWidth="2.2" strokeLinejoin="round" />
        )}

        {points.map((p, i) => (
          <g key={p.date}>
            {p.stress != null && <circle cx={x(i)} cy={y(p.stress)} r="2.8" fill={STRESS_COLOR} />}
            {p.sleep != null && <circle cx={x(i)} cy={y(p.sleep)} r="2.8" fill={SLEEP_COLOR} />}
            {i % tickEvery === 0 && (
              <text x={x(i)} y={H - PAD.bottom + 16} textAnchor="middle" className="graph__axis-label">
                {formatDayLong(p.date).replace(/(\w+) (\d+).*/, '$1 $2')}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
