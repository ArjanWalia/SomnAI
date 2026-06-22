import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BottomNav } from './BottomNav';

interface Props {
  tint?: 'sleep' | 'stress' | 'home';
  children: ReactNode;
}

export function AppShell({ tint = 'home', children }: Props) {
  return (
    <div className="shell">
      <div className={`aurora ${tint}`} />
      <div className="aurora-overlay" />
      <header className="header">
        <h1>
          Somn<span className="brand-dot">AI</span>
        </h1>
        <Link to="/settings" className="pill" style={{ textDecoration: 'none' }}>
          ✦ Claude
        </Link>
      </header>
      <main className="content">{children}</main>
      <BottomNav />
    </div>
  );
}
