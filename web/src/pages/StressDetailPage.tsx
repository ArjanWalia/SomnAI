import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ClaudePanel } from '../components/ClaudePanel';
import { LabelTimeline } from '../components/LabelTimeline';
import { Loader } from '../components/Loader';
import { ScoreCircle } from '../components/ScoreCircle';
import { useSettings } from '../context/SettingsContext';
import { stressInsights } from '../lib/claude';
import { db } from '../lib/db';
import { scoreLabel } from '../lib/format';
import { formatClock, formatDayLong } from '../shared/time';
import type { StressSession } from '../shared/types';

export default function StressDetailPage() {
  const { id } = useParams();
  const { apiKey } = useSettings();
  const [session, setSession] = useState<StressSession | null | undefined>(undefined);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!id) return;
    db.getStressSession(id).then(async (s) => {
      setSession(s);
      if (s?.video_id) setVideoUrl(await db.getMediaUrl('video', s.video_id));
      if (s?.audio_id) setAudioUrl(await db.getMediaUrl('audio', s.audio_id));
    });
  }, [id]);

  if (session === undefined) return <Loader label="Loading session…" />;
  if (session === null) return <p className="page page--error">Session not found.</p>;

  const seek = (t: number) => {
    const media = videoRef.current ?? audioRef.current;
    if (!media) return;
    media.currentTime = t;
    void media.play();
  };

  return (
    <div className="page">
      <div className="detail-head">
        <ScoreCircle score={session.stress_score} caption="stress score" size={104} />
        <div className="detail-head__meta">
          <strong>{formatDayLong(session.date)}</strong>
          <span className="muted">
            {formatClock(session.start_ts)} – {formatClock(session.end_ts)}
          </span>
          <span className="pill">{scoreLabel(session.stress_score, 'stress')}</span>
        </div>
      </div>

      <section className="card">
        <h2 className="card__title">Recording</h2>
        {videoUrl ? (
          <video ref={videoRef} controls src={videoUrl} className="media-video" playsInline />
        ) : (
          <p className="muted">Video recording isn't available for this session.</p>
        )}
        {audioUrl && !videoUrl && <audio ref={audioRef} controls src={audioUrl} className="media-audio" />}
      </section>

      <section className="card">
        <h2 className="card__title">When you were stressed</h2>
        <LabelTimeline
          title="Stressed moments"
          color="#ef6f6c"
          offsets={session.stressed_timestamps}
          onSeek={videoUrl || audioUrl ? seek : undefined}
          emptyHint="You stayed calm the whole session 🎉"
        />
      </section>

      <ClaudePanel generate={() => stressInsights(apiKey, session)} />
    </div>
  );
}
