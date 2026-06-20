import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { Loader } from './Loader';

/** A button that asks Claude for insights and renders the result. */
export function ClaudePanel({ generate }: { generate: () => Promise<string> }) {
  const { hasApiKey } = useSettings();
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  async function run() {
    setState('loading');
    setError('');
    try {
      setText(await generate());
      setState('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setState('error');
    }
  }

  if (!hasApiKey) {
    return (
      <div className="claude-panel claude-panel--locked">
        <div className="claude-panel__title">
          <span className="claude-badge claude-badge--sm">Claude</span> AI insights
        </div>
        <p>
          Add your Claude API key to get personalized, AI-powered insights on this session.
        </p>
        <Link to="/settings" className="btn btn--ghost">
          Add API key
        </Link>
      </div>
    );
  }

  return (
    <div className="claude-panel">
      <div className="claude-panel__title">
        <span className="claude-badge claude-badge--sm">Claude</span> AI insights
      </div>

      {state === 'idle' && (
        <button type="button" className="btn btn--primary" onClick={run}>
          Get insights for this session
        </button>
      )}
      {state === 'loading' && <Loader label="Claude is thinking…" />}
      {state === 'error' && (
        <>
          <p className="claude-panel__error">{error}</p>
          <button type="button" className="btn btn--ghost" onClick={run}>
            Try again
          </button>
        </>
      )}
      {state === 'done' && <InsightsText text={text} />}
    </div>
  );
}

/** Minimal markdown-ish renderer: bullet lines become a list, the rest paragraphs. */
function InsightsText({ text }: { text: string }) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="insights__list">
          {bullets.map((b, i) => (
            <li key={i}>{stripMd(b)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };

  for (const line of lines) {
    if (/^[-*•]\s+/.test(line)) {
      bullets.push(line.replace(/^[-*•]\s+/, ''));
    } else {
      flush();
      blocks.push(
        <p key={`p-${blocks.length}`} className="insights__p">
          {stripMd(line)}
        </p>,
      );
    }
  }
  flush();
  return <div className="insights">{blocks}</div>;
}

// Strip simple bold/code markdown markers so the text renders cleanly.
function stripMd(s: string): string {
  return s.replace(/\*\*(.*?)\*\*/g, '$1').replace(/`(.*?)`/g, '$1');
}
