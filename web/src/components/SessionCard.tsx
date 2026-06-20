import { scoreColor } from '../lib/format';
import { formatClock, formatDayLong } from '../shared/time';
import type { ISODate, ISOInstant } from '../shared/types';

interface Props {
  date: ISODate;
  start: ISOInstant;
  end: ISOInstant;
  score?: number | null;
  onClick?: () => void;
}

/** "(date) from (time start) to (time end)" card, optionally with a score chip. */
export function SessionCard({ date, start, end, score, onClick }: Props) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`session-card${onClick ? ' session-card--tappable' : ''}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <span className="session-card__text">
        <strong>{formatDayLong(date)}</strong> from {formatClock(start)} to {formatClock(end)}
      </span>
      {score != null && (
        <span className="session-card__score" style={{ color: scoreColor(score) }}>
          {Math.round(score)}
        </span>
      )}
    </Tag>
  );
}
