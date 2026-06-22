import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

interface Props {
  generate: (apiKey: string) => Promise<string>;
}

/** "Get insights" → calls Claude with the user's key, renders the response. */
export function ClaudePanel({ generate }: Props) {
  const { claudeKey } = useSettings();
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setText(await generate(claudeKey));
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card tint-claude stack">
      <p className="card-title" style={{ color: 'var(--claude)' }}>
        ✦ Claude insights
      </p>
      {!claudeKey ? (
        <p className="muted" style={{ margin: 0 }}>
          Add your Anthropic API key in <Link to="/settings">Settings</Link> to get
          AI-powered, actionable guidance on this session.
        </p>
      ) : text ? (
        <div className="insights">{renderMarkdown(text)}</div>
      ) : (
        <button className="btn-prominent" onClick={run} disabled={loading}>
          {loading ? 'Thinking…' : 'Get insights'}
        </button>
      )}
      {error && <p className="error-text">{error}</p>}
      {text && (
        <button onClick={run} disabled={loading} style={{ alignSelf: 'flex-start' }}>
          {loading ? 'Thinking…' : 'Regenerate'}
        </button>
      )}
    </div>
  );
}

/** Minimal markdown: bullet lists + paragraphs. */
function renderMarkdown(text: string) {
  const blocks: JSX.Element[] = [];
  let list: string[] = [];
  const flush = (key: string) => {
    if (list.length) {
      blocks.push(
        <ul key={key}>
          {list.map((li, i) => (
            <li key={i}>{li}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (/^[-*•]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      list.push(line.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, ''));
    } else {
      flush(`l${i}`);
      blocks.push(<p key={`p${i}`} style={{ margin: '6px 0' }}>{line}</p>);
    }
  });
  flush('lend');
  return <>{blocks}</>;
}
