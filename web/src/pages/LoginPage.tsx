import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { signIn, working, error } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void signIn(email);
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
              onClick={() => setMode('signin')}
              type="button"
            >
              Sign In
            </button>
            <button
              className={mode === 'signup' ? 'btn-prominent btn-full' : 'btn-full'}
              onClick={() => setMode('signup')}
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
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="btn-prominent btn-full" type="submit" disabled={working}>
              {working ? <span className="spinner" /> : mode === 'signin' ? 'Sign In' : 'Create account'}
            </button>
          </form>
          <p className="muted center" style={{ fontSize: 13, margin: 0 }}>
            Your email is stored with Butterbase and ties this account to your iPhone app.
          </p>
        </div>
      </main>
    </div>
  );
}
