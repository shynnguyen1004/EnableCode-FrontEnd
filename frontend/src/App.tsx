import { Navigate, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LessonsPage from "./pages/LessonsPage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import WorkspacePage from "./pages/WorkspacePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/lessons" element={<LessonsPage />} />
      <Route path="/workspace" element={<WorkspacePage />} />
      <Route path="/settings" element={<ProfilePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
