import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

export default function SettingsPage() {
  const { user, usingLiveBackend, signOut } = useAuth();
  const { apiKey, setApiKey, hasApiKey } = useSettings();
  const [draft, setDraft] = useState(apiKey);
  const [saved, setSaved] = useState(false);

  function save() {
    setApiKey(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="page">
      <section className="card">
        <h2 className="card__title">
          <span className="claude-badge claude-badge--sm">Claude</span> API key
        </h2>
        <p className="muted">
          Used for AI-powered insights on your sleep and work sessions. Your key is stored only in
          this browser and sent directly to Anthropic — never to our servers.
        </p>
        <input
          type="password"
          className="text-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="sk-ant-…"
          autoComplete="off"
          spellCheck={false}
        />
        <div className="row">
          <button type="button" className="btn btn--primary" onClick={save}>
            {saved ? 'Saved ✓' : 'Save key'}
          </button>
          {hasApiKey && (
            <button type="button" className="btn btn--ghost" onClick={() => { setApiKey(''); setDraft(''); }}>
              Remove
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">Account</h2>
        <p className="muted">{user?.email}</p>
        <p className="muted">
          Data backend:{' '}
          <strong>{usingLiveBackend ? 'Butterbase (live)' : 'Local demo (this browser)'}</strong>
        </p>
        <button type="button" className="btn btn--ghost" onClick={signOut}>
          Sign out
        </button>
      </section>

      <section className="card">
        <h2 className="card__title">About SomnAI</h2>
        <p className="muted">
          The web app records and scores your daytime stress from your computer's camera and mic.
          Sleep is recorded on the SomnAI iPhone app and synced here through Butterbase.
        </p>
      </section>
    </div>
  );
}
