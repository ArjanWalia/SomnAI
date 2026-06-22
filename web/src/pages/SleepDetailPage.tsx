import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ClaudePanel } from '../components/ClaudePanel';
import { LabelTimeline } from '../components/LabelTimeline';
import { Loader } from '../components/Loader';
import { useSessions } from '../hooks/useSessions';
import { mediaUrl } from '../lib/butterbase';
import { sleepInsights } from '../lib/claude';
import { isButterbaseConfigured } from '../lib/config';
import { blobUrl } from '../lib/idb';
import { SLEEP_LABEL_META, scoreColor } from '../lib/format';
import { dayShort, timeHMM } from '../shared/time';
import type { SleepSession } from '../shared/types';

export function SleepDetailPage() {
  const { id } = useParams();
  const { sleep, loading } = useSessions();
  const session = sleep.find((s) => s.id === id);

  return (
    <AppShell tint="sleep">
      {loading ? <Loader /> : !session ? <p className="muted">Session not found.</p> : <Detail session={session} />}
    </AppShell>
  );
}

function Detail({ session }: { session: SleepSession }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let revoke: string | undefined;
    (async () => {
      if (!session.audioId) return;
      if (session.audioId.startsWith('local:')) {
        const url = await blobUrl(session.audioId);
        if (url) {
          revoke = url;
          setSrc(url);
        }
      } else if (isButterbaseConfigured()) {
        setSrc(mediaUrl(session.audioId));
      }
    })();
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [session.audioId]);

  const seek = (offset: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = offset;
      void audioRef.current.play();
    }
  };

  return (
    <>
      <div className="card stack center">
        <span className="muted">{dayShort(session.start)} · {timeHMM(session.start)} – {timeHMM(session.end)}</span>
        <span className="big-score" style={{ color: scoreColor(session.sleepScore) }}>
          {Math.round(session.sleepScore)}
        </span>
        <span className="muted">sleep score</span>
      </div>

      <div className="card stack">
        <p className="card-title">Recording</p>
        {src ? (
          <audio ref={audioRef} src={src} controls style={{ width: '100%' }} />
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            The full audio is recorded on your phone. It plays here once it has synced via Butterbase.
          </p>
        )}
      </div>

      <div className="card stack">
        <p className="card-title">Events</p>
        <LabelTimeline title={SLEEP_LABEL_META.hypopnea.title} color={SLEEP_LABEL_META.hypopnea.color} timestamps={session.hypopneaTimestamps} sessionStart={session.start} sessionEnd={session.end} onSeek={seek} />
        <LabelTimeline title={SLEEP_LABEL_META.obstructive_apnea.title} color={SLEEP_LABEL_META.obstructive_apnea.color} timestamps={session.obstructiveTimestamps} sessionStart={session.start} sessionEnd={session.end} onSeek={seek} />
        <LabelTimeline title={SLEEP_LABEL_META.snoring.title} color={SLEEP_LABEL_META.snoring.color} timestamps={session.snoringTimestamps} sessionStart={session.start} sessionEnd={session.end} onSeek={seek} />
      </div>

      <ClaudePanel generate={(key) => sleepInsights(key, session)} />
    </>
  );
}
