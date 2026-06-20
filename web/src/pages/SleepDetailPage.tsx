import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ClaudePanel } from '../components/ClaudePanel';
import { LabelTimeline } from '../components/LabelTimeline';
import { Loader } from '../components/Loader';
import { ScoreCircle } from '../components/ScoreCircle';
import { useSettings } from '../context/SettingsContext';
import { sleepInsights } from '../lib/claude';
import { db } from '../lib/db';
import { computeSleepScore } from '../shared/sleepScore';
import { SLEEP_LABEL_NAMES } from '../shared/constants';
import { formatClock, formatDayLong } from '../shared/time';
import type { SleepSession } from '../shared/types';

export default function SleepDetailPage() {
  const { id } = useParams();
  const { apiKey } = useSettings();
  const [session, setSession] = useState<SleepSession | null | undefined>(undefined);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!id) return;
    db.getSleepSession(id).then(async (s) => {
      setSession(s);
      if (s?.audio_id) setAudioUrl(await db.getMediaUrl('audio', s.audio_id));
    });
  }, [id]);

  if (session === undefined) return <Loader label="Loading session…" />;
  if (session === null) return <p className="page page--error">Session not found.</p>;

  const seek = (t: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = t;
    void a.play();
  };

  const { windows } = computeSleepScore(session);
  const penalties = windows.filter((w) => w.weight !== 1);

  return (
    <div className="page">
      <div className="detail-head">
        <ScoreCircle score={session.sleep_score} caption="sleep score" size={104} />
        <div className="detail-head__meta">
          <strong>{formatDayLong(session.date)}</strong>
          <span className="muted">
            {formatClock(session.start_ts)} – {formatClock(session.end_ts)}
          </span>
        </div>
      </div>

      <section className="card">
        <h2 className="card__title">Recording</h2>
        {audioUrl ? (
          <audio ref={audioRef} controls src={audioUrl} className="media-audio" />
        ) : (
          <p className="muted">
            The full audio is stored from your phone recording. Open this session in the SomnAI app
            to listen back.
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="card__title">Events &amp; timestamps</h2>
        <LabelTimeline
          title={SLEEP_LABEL_NAMES.hypopnea}
          color="#f5a25d"
          offsets={session.hypopnea_timestamps}
          onSeek={audioUrl ? seek : undefined}
        />
        <LabelTimeline
          title={SLEEP_LABEL_NAMES.obstructive_apnea}
          color="#ef6f6c"
          offsets={session.obstructive_apnea_timestamps}
          onSeek={audioUrl ? seek : undefined}
        />
        <LabelTimeline
          title={SLEEP_LABEL_NAMES.snoring}
          color="#6c8cff"
          offsets={session.snoring_timestamps}
          onSeek={audioUrl ? seek : undefined}
        />
      </section>

      {penalties.length > 0 && (
        <section className="card">
          <h2 className="card__title">Why your score is {session.sleep_score}</h2>
          <ul className="breakdown">
            {penalties.map((w, i) => (
              <li key={i}>
                <span style={{ color: '#f5a25d' }}>{SLEEP_LABEL_NAMES[w.kind]}</span>: {w.sameCategoryCount}{' '}
                events in an hour → ×{w.weight}
                {w.applications > 1 ? ` (×${w.applications})` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ClaudePanel generate={() => sleepInsights(apiKey, session)} />
    </div>
  );
}
