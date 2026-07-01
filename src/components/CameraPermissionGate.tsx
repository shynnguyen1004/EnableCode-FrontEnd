import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { hasCameraPermissionCookie } from '../lib/cameraPermissionCookie';

interface CameraPermissionGateProps {
  children: ReactNode;
}

export default function CameraPermissionGate({ children }: CameraPermissionGateProps) {
  if (!hasCameraPermissionCookie()) {
    return <Navigate to="/camera-permission" replace />;
  }

  return children;
}
