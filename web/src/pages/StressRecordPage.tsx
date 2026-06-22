import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { AudioStressModel, type AudioEvent } from '../lib/audioModel';
import { backend } from '../lib/db';
import { SessionRecorder, openCameraMic } from '../lib/recorder';
import { VideoStressModel, type VideoSignals } from '../lib/videoModel';
import { STRESS_SAMPLE_INTERVAL_MS } from '../shared/constants';
import { StressAccumulator } from '../shared/stressScore';
import { formatElapsed } from '../shared/time';
import type { StressSession } from '../shared/types';

type Phase = 'idle' | 'starting' | 'recording' | 'saving';

export function StressRecordPage() {
  const { email } = useAuth();
  const navigate = useNavigate();
  const videoEl = useRef<HTMLVideoElement>(null);

  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<SessionRecorder | null>(null);
  const videoModel = useRef<VideoStressModel | null>(null);
  const audioModel = useRef<AudioStressModel | null>(null);
  const accumulator = useRef(new StressAccumulator());
  const startedAt = useRef<number>(0);
  const sampleTimer = useRef<number | null>(null);
  const tickTimer = useRef<number | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [calmness, setCalmness] = useState<number | null>(null);
  const [signals, setSignals] = useState<VideoSignals | null>(null);
  const [audioEvent, setAudioEvent] = useState<AudioEvent>(null);
  const [modelNote, setModelNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => void cleanup(), []);

  async function cleanup() {
    if (sampleTimer.current) clearInterval(sampleTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
    sampleTimer.current = null;
    tickTimer.current = null;
    videoModel.current?.close();
    await audioModel.current?.close();
    stream.current?.getTracks().forEach((t) => t.stop());
  }

  async function start() {
    setError(null);
    setPhase('starting');
    try {
      const media = await openCameraMic();
      stream.current = media;
      if (videoEl.current) {
        videoEl.current.srcObject = media;
        await videoEl.current.play().catch(() => undefined);
      }

      videoModel.current = new VideoStressModel();
      audioModel.current = new AudioStressModel(media);
      const [faceOk, audioOk] = await Promise.all([
        videoModel.current.load(),
        audioModel.current.load(),
      ]);
      const notes: string[] = [];
      if (!faceOk) notes.push('face model unavailable');
      notes.push(audioOk ? 'audio: YAMNet' : 'audio: DSP fallback');
      setModelNote(notes.join(' · '));

      recorder.current = new SessionRecorder(media);
      recorder.current.start();

      accumulator.current = new StressAccumulator();
      startedAt.current = Date.now();
      setPhase('recording');

      tickTimer.current = window.setInterval(() => {
        setElapsed((Date.now() - startedAt.current) / 1000);
      }, 250);

      sampleTimer.current = window.setInterval(() => void sample(), STRESS_SAMPLE_INTERVAL_MS);
    } catch (e) {
      setError(`Could not start recording: ${String(e)}`);
      setPhase('idle');
      await cleanup();
    }
  }

  async function sample() {
    const t = (Date.now() - startedAt.current) / 1000;
    let video: number | null = null;
    if (videoModel.current && videoEl.current) {
      const s = videoModel.current.analyze(videoEl.current, performance.now());
      if (s) {
        video = s.calmness;
        setSignals(s);
      }
    }
    let audio: number | null = null;
    if (audioModel.current) {
      const a = await audioModel.current.sample();
      audio = a.calmness;
      setAudioEvent(a.event);
    }
    accumulator.current.push({ t, video, audio });
    setCalmness(accumulator.current.latest);
  }

  async function stop() {
    if (!email) return;
    setPhase('saving');
    if (sampleTimer.current) clearInterval(sampleTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);

    const media = await recorder.current?.stop();
    const end = new Date();
    const start = new Date(startedAt.current);
    const { stressScore, stressedOffsets } = accumulator.current.result();

    const session: StressSession = {
      id: `stress-${startedAt.current.toString(36)}`,
      start: start.toISOString(),
      end: end.toISOString(),
      stressScore,
      videoId: null,
      audioId: null,
      stressedTimestamps: stressedOffsets.map((o) =>
        new Date(start.getTime() + o * 1000).toISOString(),
      ),
    };

    try {
      const saved = await backend().saveStress(email, session, media);
      await cleanup();
      navigate(`/stress/${saved.id}`);
    } catch (e) {
      setError(`Saved locally, but sync failed: ${String(e)}`);
      await cleanup();
      navigate('/stress');
    }
  }

  const recording = phase === 'recording';

  return (
    <AppShell tint="stress">
      <div className="recorder-stage">
        <video ref={videoEl} muted playsInline />
        {recording && (
          <div className="rec-badge">
            <span className="blink" /> REC <span className="mono">{formatElapsed(elapsed)}</span>
          </div>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card stack center">
        <span className="muted">Live calmness</span>
        <span className="big-score" style={{ color: 'var(--stress)' }}>
          {calmness == null ? '—' : Math.round(calmness * 100)}
        </span>
        {modelNote && <span className="muted" style={{ fontSize: 12 }}>{modelNote}</span>}
      </div>

      {recording && signals && (
        <div className="card stack">
          <p className="card-title">Face signals</p>
          <div className="signal-grid">
            <Signal label="Brow tension" value={signals.browTension} />
            <Signal label="Eye squint" value={signals.eyeSquint} />
            <Signal label="Frown" value={signals.frown} />
            <Signal label="Cringe" value={signals.cringe} />
            <Signal label="Sweat" value={signals.sweat} />
            <Signal label="Eye redness" value={signals.eyeRedness} />
            <Signal label="Head motion" value={signals.headMotion} />
          </div>
          {!signals.faceVisible && <p className="muted" style={{ margin: 0 }}>No face detected.</p>}
          {audioEvent && <span className="pill demo" style={{ alignSelf: 'flex-start' }}>heard: {audioEvent.replace('_', ' ')}</span>}
        </div>
      )}

      {phase === 'idle' && (
        <button className="btn-stress btn-full" onClick={start}>
          ● Start recording
        </button>
      )}
      {phase === 'starting' && <button className="btn-full" disabled>Starting camera &amp; models…</button>}
      {recording && (
        <button className="btn-danger btn-full" onClick={stop}>
          ■ Stop &amp; save
        </button>
      )}
      {phase === 'saving' && <button className="btn-full" disabled>Saving…</button>}

      <p className="muted center" style={{ fontSize: 13 }}>
        Two on-device models run here — a face/expression model and a YAMNet audio
        model. Nothing leaves your computer except the saved recording.
      </p>
    </AppShell>
  );
}

function Signal({ label, value }: { label: string; value: number }) {
  return (
    <div className="signal">
      <div className="row">
        <span>{label}</span>
        <span className="muted mono">{Math.round(value * 100)}</span>
      </div>
      <div className="bar">
        <span style={{ width: `${Math.round(value * 100)}%`, background: value > 0.5 ? 'var(--stress)' : 'var(--accent)' }} />
      </div>
    </div>
  );
}
