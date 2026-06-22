import { useEffect, useState } from 'react';
import { scoreColor } from '../lib/format';

interface Props {
  score: number | null;
  label: string;
  small?: boolean;
}

/** Animated progress ring with the score in the center (mirrors the iOS orb). */
export function ScoreCircle({ score, label, small }: Props) {
  const size = small ? 104 : 132;
  const stroke = small ? 9 : 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = score ?? 0;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / 1100);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const color = scoreColor(target);
  const offset = circumference * (1 - shown / 100);

  return (
    <div className="orb">
      <div className={`ring${small ? ' small' : ''}`} style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ filter: `drop-shadow(0 0 6px ${color}aa)` }}
          />
        </svg>
        <div className="value">
          <span className="num">{score == null ? '—' : Math.round(shown)}</span>
          <span className="sub">/ 100</span>
        </div>
      </div>
      <span className="label">{label}</span>
    </div>
  );
}
