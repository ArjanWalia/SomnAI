import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', label: 'home', icon: HomeIcon },
  { to: '/stress', label: 'stress', icon: StressIcon },
  { to: '/sleep', label: 'sleep', icon: SleepIcon },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `nav-item${isActive ? ' nav-item--active' : ''}`}
        >
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        d="M3 11l9-7 9 7M5 10v10h14V10"
      />
    </svg>
  );
}

function StressIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13h3l2-6 3 12 2.5-8L19 13h2"
      />
    </svg>
  );
}

function SleepIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 14.5A7.5 7.5 0 1 1 9.5 4a6 6 0 0 0 10.5 10.5z"
      />
    </svg>
  );
}
