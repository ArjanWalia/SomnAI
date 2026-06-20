import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { signIn, signUp, usingLiveBackend } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'signin') await signIn(email, password);
      else await signUp(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not authenticate.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand">
          <span className="brand__mark">◓</span>
          <span className="brand__name">SomnAI</span>
        </div>
        <p className="auth-tagline">Track your sleep and your daytime stress, in one place.</p>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'signin' ? 'auth-tab auth-tab--active' : 'auth-tab'}
            onClick={() => setMode('signin')}
          >
            Log in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'auth-tab auth-tab--active' : 'auth-tab'}
            onClick={() => setMode('signup')}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={submit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Log in' : 'Create account'}
          </button>
        </form>

        {!usingLiveBackend && (
          <p className="auth-hint">
            Demo mode — no Butterbase key is configured, so accounts and data live only in this
            browser. Sign up with any email to explore.
          </p>
        )}
      </div>
    </div>
  );
}
