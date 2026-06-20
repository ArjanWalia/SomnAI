import { scoreColor } from '../lib/format';

interface Props {
  score: number | null;
  caption: string;
  size?: number;
}

/** The big circular score readout used on Home and the Stress page. */
export function ScoreCircle({ score, caption, size = 132 }: Props) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const color = score == null ? '#3a4668' : scoreColor(score);

  return (
    <div className="score-circle" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#222b45"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          className="score-circle__value"
          fill="#f5f7ff"
        >
          {score == null ? '—' : Math.round(score)}
        </text>
      </svg>
      <span className="score-circle__caption">{caption}</span>
    </div>
  );
}
