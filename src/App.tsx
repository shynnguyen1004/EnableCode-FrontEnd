import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { EyeTrackingProvider, useEyeTracking } from './context/EyeTrackingContext';
import CameraPermissionGate from './components/CameraPermissionGate';
import HomePage from './pages/HomePage';
import CameraPermissionPage from './pages/CameraPermissionPage';
import LessonsPage from './pages/LessonsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FaceLoginPage from './pages/FaceLoginPage';
import FaceRegisterPage from './pages/FaceRegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
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
  const location = useLocation();
  const showEyeTracking = location.pathname !== '/camera-permission';

  if (isMobile) {
    return <MobileUnsupported />;
  }

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <CameraPermissionGate>
              <HomePage />
            </CameraPermissionGate>
          }
        />
        <Route path="/camera-permission" element={<CameraPermissionPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/face-login" element={<FaceLoginPage />} />
        <Route path="/face-register" element={<FaceRegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/lessons" element={<TopicPage />} />
        <Route path="/lessons/:topicId" element={<LessonsPage />} />
        <Route path="/workspace/:lessonId" element={<WorkspacePage />} />
        <Route path="/workspace" element={<Navigate to="/lessons" replace />} />
        <Route path="/settings" element={<ProfilePage />} />
        <Route path="/calibration" element={<CalibrationPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showEyeTracking && <EyeTrackingLayer />}
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
