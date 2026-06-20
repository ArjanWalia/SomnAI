import { useNavigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';

function titleFor(pathname: string): string {
  if (pathname === '/') return 'Home';
  if (pathname.startsWith('/stress/record')) return 'Record';
  if (pathname.startsWith('/stress/')) return 'Work session';
  if (pathname === '/stress') return 'Stress';
  if (pathname.startsWith('/sleep/')) return 'Sleep session';
  if (pathname === '/sleep') return 'Sleep';
  if (pathname === '/settings') return 'Settings';
  return 'SomnAI';
}

/** The phone-shaped app frame: header with a Claude button, scrollable body, bottom nav. */
export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="app-frame">
      <header className="app-header">
        <span className="app-header__spacer" aria-hidden="true" />
        <h1 className="app-header__title">{titleFor(pathname)}</h1>
        <button
          type="button"
          className="claude-badge"
          onClick={() => navigate('/settings')}
          aria-label="Claude settings and insights"
          title="Claude"
        >
          Claude
        </button>
      </header>

      <main className="app-body">{children}</main>

      <BottomNav />
    </div>
  );
}
