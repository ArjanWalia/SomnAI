import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { useAuth } from './context/AuthContext';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SettingsPage from './pages/SettingsPage';
import SleepDetailPage from './pages/SleepDetailPage';
import SleepPage from './pages/SleepPage';
import StressDetailPage from './pages/StressDetailPage';
import StressPage from './pages/StressPage';
import StressRecordPage from './pages/StressRecordPage';
import type { ReactNode } from 'react';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <AppShell>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/stress" element={<StressPage />} />
                <Route path="/stress/record" element={<StressRecordPage />} />
                <Route path="/stress/:id" element={<StressDetailPage />} />
                <Route path="/sleep" element={<SleepPage />} />
                <Route path="/sleep/:id" element={<SleepDetailPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          </RequireAuth>
        }
      />
    </Routes>
  );
}
