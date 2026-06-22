import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ClaudePanel } from '../components/ClaudePanel';
import { Loader } from '../components/Loader';
import { useSessions } from '../hooks/useSessions';
import { mediaUrl } from '../lib/butterbase';
import { stressInsights } from '../lib/claude';
import { isButterbaseConfigured } from '../lib/config';
import { blobUrl } from '../lib/idb';
import { scoreColor } from '../lib/format';
import { dayShort, offsetSeconds, timeHMM } from '../shared/time';
import type { StressSession } from '../shared/types';

export function StressDetailPage() {
  const { id } = useParams();
  const { stress, loading } = useSessions();
  const session = stress.find((s) => s.id === id);
  return (
    <AppShell tint="stress">
      {loading ? <Loader /> : !session ? <p className="muted">Session not found.</p> : <Detail session={session} />}
    </AppShell>
  );
}

function useMediaSrc(objectId?: string | null) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | undefined;
    (async () => {
      if (!objectId) return;
      if (objectId.startsWith('local:')) {
        const url = await blobUrl(objectId);
        if (url) {
          revoke = url;
          setSrc(url);
        }
      } else if (isButterbaseConfigured()) {
        setSrc(mediaUrl(objectId));
      }
    })();
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [objectId]);
  return src;
}

function Detail({ session }: { session: StressSession }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoSrc = useMediaSrc(session.videoId);
  const audioSrc = useMediaSrc(session.audioId);
  const total = Math.max(1, offsetSeconds(session.start, session.end));

  const seek = (offset: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = offset;
      void videoRef.current.play();
    }
  };

  return (
    <>
      <div className="card stack center">
        <span className="muted">{dayShort(session.start)} · {timeHMM(session.start)} – {timeHMM(session.end)}</span>
        <span className="big-score" style={{ color: scoreColor(session.stressScore) }}>
          {Math.round(session.stressScore)}
        </span>
        <span className="muted">calmness score (100 = perfectly calm)</span>
      </div>

      <div className="card stack">
        <p className="card-title">Recording</p>
        {videoSrc ? (
          <video ref={videoRef} src={videoSrc} controls playsInline style={{ width: '100%', borderRadius: 12 }} />
        ) : (
          <p className="muted" style={{ margin: 0 }}>Camera recording isn’t available for this session.</p>
        )}
        {audioSrc && <audio src={audioSrc} controls style={{ width: '100%' }} />}
      </div>

      <div className="card stack">
        <p className="card-title">Stressed moments</p>
        {session.stressedTimestamps.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No stressed moments were flagged — nicely calm.</p>
        ) : (
          <>
            <div className="timeline">
              {session.stressedTimestamps.map((t, i) => {
                const o = offsetSeconds(session.start, t);
                return <span key={i} className="seg" style={{ left: `${(o / total) * 100}%`, background: '#ff8c80' }} />;
              })}
            </div>
            <div className="chips">
              {session.stressedTimestamps.map((t, i) => {
                const o = offsetSeconds(session.start, t);
                const m = Math.floor(o / 60);
                const s = Math.floor(o % 60);
                return (
                  <span key={i} className="chip" onClick={() => seek(o)}>
                    {m}:{String(s).padStart(2, '0')}
                  </span>
                );
              })}
            </div>
          </>
        )}
      </div>

      <ClaudePanel generate={(key) => stressInsights(key, session)} />
    </>
  );
}
