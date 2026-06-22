import type { GraphPoint } from '../lib/graphData';

interface Props {
  points: GraphPoint[];
}

const W = 320;
const H = 190;
const PAD = 28;

/** Dual-line SVG chart: stress (coral) + sleep (blue), per-day points. */
export function ScoreGraph({ points }: Props) {
  if (points.length === 0) {
    return <p className="muted center">No data yet — record a session to start your graph.</p>;
  }

  const x = (i: number) =>
    PAD + (points.length === 1 ? (W - 2 * PAD) / 2 : (i / (points.length - 1)) * (W - 2 * PAD));
  const y = (v: number) => H - PAD - (v / 100) * (H - 2 * PAD);

  const line = (key: 'sleep' | 'stress') => {
    const pts = points
      .map((p, i) => ({ i, v: p[key] }))
      .filter((p): p is { i: number; v: number } => p.v != null);
    if (pts.length === 0) return null;
    const d = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${x(p.i)},${y(p.v)}`).join(' ');
    const color = key === 'sleep' ? '#7399ff' : '#ff8c80';
    return (
      <g key={key}>
        <path d={d} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p) => (
          <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={2.8} fill={color} />
        ))}
      </g>
    );
  };

  const tickEvery = Math.max(1, Math.ceil(points.length / 4));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Stress and sleep score graph">
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={PAD} x2={W - PAD} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.08)" />
            <text x={4} y={y(v) + 4} fill="rgba(255,255,255,0.4)" fontSize={10}>
              {v}
            </text>
          </g>
        ))}
        {line('sleep')}
        {line('stress')}
        {points.map((p, i) =>
          i % tickEvery === 0 ? (
            <text key={p.key} x={x(i)} y={H - 8} fill="rgba(255,255,255,0.4)" fontSize={10} textAnchor="middle">
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
      <div className="row" style={{ justifyContent: 'center', gap: 18, fontSize: 13 }}>
        <span className="row" style={{ gap: 6 }}>
          <span className="dot" style={{ background: '#ff8c80' }} /> Stress
        </span>
        <span className="row" style={{ gap: 6 }}>
          <span className="dot" style={{ background: '#7399ff' }} /> Sleep
        </span>
      </div>
    </div>
  );
}
