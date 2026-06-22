import { useState } from 'react';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { testConnection } from '../lib/butterbase';
import { CLAUDE_MODEL } from '../lib/claude';
import { isButterbaseConfigured } from '../lib/config';

export function SettingsPage() {
  const { email, signOut } = useAuth();
  const { claudeKey, setClaudeKey, butterbaseToken, setButterbaseToken } = useSettings();
  const [claudeDraft, setClaudeDraft] = useState(claudeKey);
  const [tokenDraft, setTokenDraft] = useState(butterbaseToken);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const live = isButterbaseConfigured();

  const runTest = async () => {
    setButterbaseToken(tokenDraft);
    setTesting(true);
    setTestResult(null);
    const r = await testConnection();
    setTestResult(r.message);
    setTesting(false);
  };

  return (
    <AppShell tint="home">
      <div className="card stack">
        <p className="card-title">Account</p>
        <div className="row spread">
          <span className="muted">Signed in as</span>
          <strong>{email}</strong>
        </div>
        <span className={`pill ${live ? 'live' : 'demo'}`} style={{ alignSelf: 'flex-start' }}>
          {live ? '● Live Butterbase sync' : '○ Demo mode (local data)'}
        </span>
        <button className="btn-danger btn-full" onClick={signOut}>
          Sign out
        </button>
      </div>

      <div className="card stack">
        <p className="card-title" style={{ color: 'var(--claude)' }}>Claude API key</p>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Stored only in this browser and sent directly to Anthropic. Powers insights
          using <strong>{CLAUDE_MODEL}</strong>.
        </p>
        <div className="field">
          <input
            type="password"
            placeholder="sk-ant-…"
            value={claudeDraft}
            onChange={(e) => setClaudeDraft(e.target.value)}
          />
        </div>
        <button className="btn-prominent btn-full" onClick={() => setClaudeKey(claudeDraft)}>
          Save key
        </button>
      </div>

      <div className="card stack">
        <p className="card-title">Butterbase token</p>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          A <code>bb_sk_…</code> service key or user JWT for app <code>app_kf3crd1822g8</code>.
          Leave empty to stay in demo mode.
        </p>
        <div className="field">
          <input
            type="password"
            placeholder="bb_sk_… or user JWT"
            value={tokenDraft}
            onChange={(e) => setTokenDraft(e.target.value)}
          />
        </div>
        <div className="btn-row">
          <button className="btn-full" onClick={() => setButterbaseToken(tokenDraft)}>
            Save token
          </button>
          <button className="btn-prominent btn-full" onClick={runTest} disabled={testing}>
            {testing ? 'Testing…' : 'Test connection'}
          </button>
        </div>
        {testResult && <p className="muted" style={{ margin: 0 }}>{testResult}</p>}
      </div>
    </AppShell>
  );
}
