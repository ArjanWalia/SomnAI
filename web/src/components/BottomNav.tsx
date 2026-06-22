import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', glyph: '◎', label: 'Home', end: true },
  { to: '/stress', glyph: '🧠', label: 'Stress', end: false },
  { to: '/sleep', glyph: '🌙', label: 'Sleep', end: false },
  { to: '/settings', glyph: '⚙', label: 'Settings', end: false },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="glyph">{t.glyph}</span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
