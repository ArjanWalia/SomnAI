import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';
import { SleepDetailPage } from './pages/SleepDetailPage';
import { SleepPage } from './pages/SleepPage';
import { StressDetailPage } from './pages/StressDetailPage';
import { StressPage } from './pages/StressPage';
import { StressRecordPage } from './pages/StressRecordPage';

export default function App() {
  const { isSignedIn } = useAuth();

  if (!isSignedIn) return <LoginPage />;

  return (
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
  );
}
