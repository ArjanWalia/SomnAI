import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { signIn, signUp, working, error } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (mode === 'signup' && password !== confirm) {
      setLocalError('Passwords do not match.');
      return;
    }
    if (mode === 'signup') void signUp(email, password);
    else void signIn(email, password);
  };

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next);
    setLocalError(null);
  };

  return (
    <div className="shell">
      <div className="aurora sleep" />
      <div className="aurora-overlay" />
      <main className="content" style={{ justifyContent: 'center', minHeight: '100dvh' }}>
        <div className="center stack" style={{ gap: 6, marginBottom: 12 }}>
          <h1 style={{ fontSize: 38, margin: 0 }}>
            Somn<span style={{ color: 'var(--accent)' }}>AI</span>
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            Track your sleep and your daytime stress in one place.
          </p>
        </div>

        <div className="card stack">
          <div className="btn-row">
            <button
              className={mode === 'signin' ? 'btn-prominent btn-full' : 'btn-full'}
              onClick={() => switchMode('signin')}
              type="button"
            >
              Sign In
            </button>
            <button
              className={mode === 'signup' ? 'btn-prominent btn-full' : 'btn-full'}
              onClick={() => switchMode('signup')}
              type="button"
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={submit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {mode === 'signup' && (
              <div className="field">
                <label htmlFor="confirm">Confirm password</label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
            )}
            {(localError || error) && <p className="error-text">{localError ?? error}</p>}
            <button className="btn-prominent btn-full" type="submit" disabled={working}>
              {working ? <span className="spinner" /> : mode === 'signin' ? 'Sign In' : 'Create account'}
            </button>
          </form>
          <p className="muted center" style={{ fontSize: 13, margin: 0 }}>
            Your email + password sign you in; the email ties this account to your iPhone app.
          </p>
        </div>
      </main>
    </div>
  );
}
