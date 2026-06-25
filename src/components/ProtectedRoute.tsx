import { JSX, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCalibration } from '../context/CalibrationContext';

export default function ProtectedRoute({
  children,
  requireCalibration = false,
}: {
  children: JSX.Element;
  requireCalibration?: boolean;
}) {
  const { isLoggedIn } = useAuth();
  const { calibration, isLoading } = useCalibration();

  const [isInitialMount, setIsInitialMount] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsInitialMount(false), 100);
    return () => clearTimeout(timer);
  }, []);

  // 1. Kiểm tra đăng nhập
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (requireCalibration) {
    if (isLoading || isInitialMount) {
      return (
        <div
          style={{
            display: 'flex',
            height: '100vh',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a202c',
          }}
        >
          <Loader2 size={48} className="animate-spin" color="#ff7700" />
        </div>
      );
    }

    if (!calibration) {
      return <Navigate to="/calibration" replace />;
    }
  }

  return children;
}
