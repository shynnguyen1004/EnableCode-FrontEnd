import { JSX } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({
  children,
  requireCalibration = false,
}: {
  children: JSX.Element;
  requireCalibration?: boolean;
}) {
  const { isLoggedIn, user } = useAuth();

  if (!isLoggedIn) return <Navigate to="/login" replace />;

  if (requireCalibration && !user?.isCalibrated) {
    return <Navigate to="/calibration" replace />;
  }

  return children;
}
