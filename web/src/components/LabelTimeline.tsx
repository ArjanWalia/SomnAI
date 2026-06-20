import { formatDuration } from '../shared/time';
import type { OffsetSeconds } from '../shared/types';

interface Props {
  title: string;
  color: string;
  offsets: OffsetSeconds[];
  /** Called with the offset (seconds) when a chip is tapped, to seek media. */
  onSeek?: (seconds: number) => void;
  emptyHint?: string;
}

/** A labelled row of timestamp chips that jump the media to "the exact time". */
export function LabelTimeline({ title, color, offsets, onSeek, emptyHint }: Props) {
  return (
    <div className="timeline">
      <div className="timeline__head">
        <span className="timeline__dot" style={{ background: color }} />
        <span className="timeline__title">{title}</span>
        <span className="timeline__count">{offsets.length}</span>
      </div>
      {offsets.length === 0 ? (
        <p className="timeline__empty">{emptyHint ?? 'None detected'}</p>
      ) : (
        <div className="timeline__chips">
          {offsets.map((t, i) => (
            <button
              key={`${t}-${i}`}
              type="button"
              className="chip"
              onClick={() => onSeek?.(t)}
              style={{ borderColor: color }}
            >
              {formatDuration(t)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
