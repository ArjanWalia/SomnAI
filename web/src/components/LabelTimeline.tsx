import { offsetSeconds } from '../shared/time';

interface Props {
  title: string;
  color: string;
  /** Absolute ISO instants of each label. */
  timestamps: string[];
  sessionStart: string;
  sessionEnd: string;
  /** Seek the media to this offset (seconds). */
  onSeek?: (offsetSec: number) => void;
}

/** A colored timeline + clickable offset chips for one label category. */
export function LabelTimeline({ title, color, timestamps, sessionStart, sessionEnd, onSeek }: Props) {
  const total = Math.max(1, offsetSeconds(sessionStart, sessionEnd));
  const offsets = timestamps.map((t) => offsetSeconds(sessionStart, t)).sort((a, b) => a - b);

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row spread">
        <span className="row" style={{ gap: 8 }}>
          <span className="dot" style={{ background: color }} />
          {title}
        </span>
        <span className="muted">{offsets.length}</span>
      </div>
      <div className="timeline">
        {offsets.map((o, i) => (
          <span
            key={i}
            className="seg"
            title={`${Math.round(o)}s`}
            style={{ left: `${(o / total) * 100}%`, background: color }}
          />
        ))}
      </div>
      {offsets.length > 0 && (
        <div className="chips">
          {offsets.map((o, i) => (
            <span key={i} className="chip" onClick={() => onSeek?.(o)}>
              {fmt(o)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
