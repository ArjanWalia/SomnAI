import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { AudioModel } from '../lib/audioModel';
import { db } from '../lib/db';
import { SessionRecorder } from '../lib/recorder';
import type { VideoFeatures, VideoModel } from '../lib/videoModel';
import { STRESS_SAMPLE_INTERVAL_MS } from '../shared/constants';
import { StressAccumulator } from '../shared/stressScore';
import { formatDuration, nowISO, toISODate } from '../shared/time';

type Phase = 'idle' | 'starting' | 'recording' | 'saving' | 'error';

export default function StressRecordPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [calmness, setCalmness] = useState<number | null>(null);
  const [features, setFeatures] = useState<VideoFeatures | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [modelNote, setModelNote] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<SessionRecorder | null>(null);
  const videoModelRef = useRef<VideoModel | null>(null);
  const audioModelRef = useRef<AudioModel | null>(null);
  const accRef = useRef<StressAccumulator | null>(null);
  const startRef = useRef<number>(0);
  const startInstantRef = useRef<string>('');
  const sampleTimer = useRef<number | null>(null);
  const tickTimer = useRef<number | null>(null);

  const teardown = useCallback(() => {
    if (sampleTimer.current) window.clearInterval(sampleTimer.current);
    if (tickTimer.current) window.clearInterval(tickTimer.current);
    sampleTimer.current = null;
    tickTimer.current = null;
    videoModelRef.current?.close();
    audioModelRef.current?.close();
    videoModelRef.current = null;
    audioModelRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Always release the camera/mic if the user navigates away mid-recording.
  useEffect(() => () => teardown(), [teardown]);

  const start = useCallback(async () => {
    setError('');
    setModelNote('');
    setPhase('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      // Lazy-load the two on-device models (keeps MediaPipe out of the main
      // bundle) and degrade gracefully if either can't load.
      const [videoMod, audioMod] = await Promise.all([
        import('../lib/videoModel'),
        import('../lib/audioModel'),
      ]);
      const [video, audio] = await Promise.all([
        videoMod.createVideoModel().catch(() => null),
        audioMod.createAudioModel(stream).catch(() => null),
      ]);
      videoModelRef.current = video;
      audioModelRef.current = audio;
      if (!video && !audio) {
        setModelNote('Models could not load — recording without live stress analysis.');
      } else if (!video) {
        setModelNote('Face model unavailable — scoring from audio only.');
      } else if (!audio) {
        setModelNote('Audio model unavailable — scoring from video only.');
      }

      accRef.current = new StressAccumulator();
      startRef.current = performance.now();
      startInstantRef.current = nowISO();
      setElapsed(0);

      recorderRef.current = new SessionRecorder(stream);
      recorderRef.current.start();

      sampleTimer.current = window.setInterval(() => {
        const acc = accRef.current;
        if (!acc) return;
        const t = (performance.now() - startRef.current) / 1000;
        const v = videoRef.current && videoModelRef.current
          ? videoModelRef.current.analyze(videoRef.current, performance.now())
          : null;
        const a = audioModelRef.current?.sample() ?? null;
        const calm = acc.push({ t, video: v?.calmness ?? null, audio: a?.calmness ?? null });
        setCalmness(calm);
        setFeatures(v?.features ?? null);
        setEvents(a?.events ?? []);
      }, STRESS_SAMPLE_INTERVAL_MS);

      tickTimer.current = window.setInterval(() => {
        setElapsed(Math.floor((performance.now() - startRef.current) / 1000));
      }, 250);

      setPhase('recording');
    } catch (e) {
      teardown();
      setError(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Camera and microphone access was denied. Enable it and try again.'
          : 'Could not start recording. Check your camera and microphone.',
      );
      setPhase('error');
    }
  }, [teardown]);

  const stop = useCallback(async () => {
    if (!user || !recorderRef.current || !accRef.current) return;
    setPhase('saving');
    if (sampleTimer.current) window.clearInterval(sampleTimer.current);
    if (tickTimer.current) window.clearInterval(tickTimer.current);

    const acc = accRef.current;
    const recording = await recorderRef.current.stop();
    videoModelRef.current?.close();
    audioModelRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    // Null the refs so the unmount teardown doesn't double-close them.
    videoModelRef.current = null;
    audioModelRef.current = null;
    streamRef.current = null;

    const startInstant = startInstantRef.current;
    const endInstant = nowISO();
    const clientId = crypto.randomUUID();
    const prefix = `${user.id}/${clientId}`;

    try {
      const [videoId, audioId] = await Promise.all([
        db.uploadMedia('video', `${prefix}/video.webm`, recording.video),
        db.uploadMedia('audio', `${prefix}/audio.webm`, recording.audio),
      ]);

      const saved = await db.createStressSession({
        user_id: user.id,
        date: toISODate(new Date(startInstant)),
        start_ts: startInstant,
        end_ts: endInstant,
        stress_score: acc.stressScore,
        video_id: videoId,
        audio_id: audioId,
        stressed_timestamps: acc.stressedTimestamps,
      });
      navigate(`/stress/${saved.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the session.');
      setPhase('error');
    }
  }, [navigate, user]);

  const liveScore = calmness == null ? null : Math.round(calmness * 100);

  return (
    <div className="page record-page">
      <div className="record-stage">
        <video ref={videoRef} className="record-video" muted playsInline />
        {phase === 'recording' && (
          <div className="record-badge">
            <span className="record-dot" /> {formatDuration(elapsed)}
          </div>
        )}
        {phase === 'recording' && liveScore != null && (
          <div className="record-gauge" style={{ ['--p' as string]: `${liveScore}%` }}>
            <span className="record-gauge__num">{liveScore}</span>
            <span className="record-gauge__cap">calm</span>
          </div>
        )}
      </div>

      {modelNote && <p className="muted record-note">{modelNote}</p>}

      {phase === 'recording' && (
        <div className="card">
          <h2 className="card__title">Live signals</h2>
          {features?.faceVisible ? (
            <div className="signals">
              <Signal label="Brow tension" value={features.browTension} />
              <Signal label="Frown" value={features.frown} />
              <Signal label="Eye squint" value={features.eyeSquint} />
              <Signal label="Cringe" value={features.cringe} />
              <Signal label="Sweat" value={features.sweat} />
              <Signal label="Eye redness" value={features.eyeRedness} />
            </div>
          ) : (
            <p className="muted">Looking for your face…</p>
          )}
          <div className="event-tags">
            {events.length === 0 ? (
              <span className="muted">Audio: calm</span>
            ) : (
              events.map((ev) => (
                <span key={ev} className="event-tag">
                  {ev.replace('_', ' ')}
                </span>
              ))
            )}
          </div>
        </div>
      )}

      {error && <p className="page--error">{error}</p>}

      <div className="record-controls">
        {(phase === 'idle' || phase === 'error') && (
          <button type="button" className="btn btn--primary btn--block" onClick={start}>
            ● Start recording
          </button>
        )}
        {phase === 'starting' && (
          <button type="button" className="btn btn--block" disabled>
            Starting camera…
          </button>
        )}
        {phase === 'recording' && (
          <button type="button" className="btn btn--danger btn--block" onClick={stop}>
            ■ Stop &amp; save
          </button>
        )}
        {phase === 'saving' && (
          <button type="button" className="btn btn--block" disabled>
            Scoring &amp; saving…
          </button>
        )}
      </div>

      <p className="muted record-disclaimer">
        Your camera and microphone are analysed entirely on your computer. Only the recording and
        scores you save are uploaded.
      </p>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: number }) {
  return (
    <div className="signal">
      <span className="signal__label">{label}</span>
      <span className="signal__bar">
        <span className="signal__fill" style={{ width: `${Math.round(value * 100)}%` }} />
      </span>
    </div>
  );
}
