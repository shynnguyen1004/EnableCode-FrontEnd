import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { EyeTrackingProvider, useEyeTracking } from './context/EyeTrackingContext';
import HomePage from './pages/HomePage';
import LessonsPage from './pages/LessonsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FaceRegisterPage from './pages/FaceRegisterPage';
import CalibrationPage from './pages/CalibrationPage';
import ProfilePage from './pages/ProfilePage';
import TopicPage from './pages/TopicPage';
import WorkspacePage from './pages/WorkspacePage';
import Mouse from './components/Mouse';
import MobileUnsupported from './components/MobileUnsupported';
import { useIsMobile } from './hooks/useIsMobile';
import { CalibrationProvider } from './context/CalibrationContext';

function EyeTrackingLayer() {
  const { isEnabled } = useEyeTracking();
  return isEnabled ? <Mouse /> : null;
}

function AppRoutes() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileUnsupported />;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/face-register" element={<FaceRegisterPage />} />
        <Route path="/lessons" element={<TopicPage />} />
        <Route path="/lessons/:topicId" element={<LessonsPage />} />
        <Route path="/workspace/:lessonId" element={<WorkspacePage />} />
        <Route path="/workspace" element={<Navigate to="/lessons" replace />} />
        <Route path="/settings" element={<ProfilePage />} />
        <Route path="/calibration" element={<CalibrationPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <EyeTrackingLayer />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CalibrationProvider>
        <EyeTrackingProvider>
          <AppRoutes />
        </EyeTrackingProvider>
      </CalibrationProvider>
    </AuthProvider>
  );
}
