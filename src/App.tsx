import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import HomePage from './pages/HomePage';
import LessonsPage from './pages/LessonsPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import TopicPage from './pages/TopicPage';
import WorkspacePage from './pages/WorkspacePage';

export default function App() {
  return (
    <AuthProvider>
      <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/lessons" element={<TopicPage />} />
        <Route path="/lessons/:topicId" element={<LessonsPage />} />
        <Route path="/workspace/:lessonId" element={<WorkspacePage />} />
        <Route path="/workspace" element={<Navigate to="/lessons" replace />} />
        <Route path="/settings" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Mouse />
    </AuthProvider>
  );
}
