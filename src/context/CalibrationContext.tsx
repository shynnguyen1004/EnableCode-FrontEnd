/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import type { Calibration } from '../lib/types';
import { profileApi } from '../api/profileApi';

interface CalibrationContextType {
  calibration: Calibration | null;
  isLoading: boolean;
  refreshCalibration: () => Promise<void>;
  setCalibration: (calibration: Calibration | null) => void; // Hàm gán trực tiếp dữ liệu (tối ưu hóa network)
}

const CalibrationContext = createContext<CalibrationContextType | undefined>(undefined);

const DEFAULT_CALIBRATION: Calibration = {
  _id: 'default',
  userId: 'guest',
  bounds: {
    center: { x: -0.05, y: 0 },
    left: { x: 0.1, y: 0.02 },
    right: { x: -0.15, y: -0.05 },
    top: { x: -0.03, y: -0.06 },
    bottom: { x: -0.08, y: 0.04 },
  },
  preferences: {
    speed: 0.85,
    mouthDragThreshold: 0.03,
    mouthCompensationRatio: 0.5,
  },
};

interface CalibrationProviderProps {
  children: ReactNode;
}

export function CalibrationProvider({ children }: CalibrationProviderProps) {
  const { isLoggedIn, accessToken } = useAuth();
  const [calibration, setCalibration] = useState<Calibration | null>(DEFAULT_CALIBRATION);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Đưa logic fetch dữ liệu ra ngoài useEffect và bọc bằng useCallback để giữ vững tham chiếu hàm
  const refreshCalibration = useCallback(async () => {
    if (!isLoggedIn || !accessToken) return;

    setIsLoading(true);
    try {
      const response = await profileApi.getCalibration();
      setCalibration(response);
    } catch (error) {
      console.error('Lỗi khi tải dữ liệu cấu hình khuôn mặt:', error);
      setCalibration(DEFAULT_CALIBRATION);
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn, accessToken]);

  useEffect(() => {
    if (!isLoggedIn || !accessToken) {
      const timer = setTimeout(() => {
        setCalibration(DEFAULT_CALIBRATION);
      }, 0);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      refreshCalibration();
    }, 0);

    return () => clearTimeout(timer);
  }, [isLoggedIn, accessToken, refreshCalibration]);

  return (
    <CalibrationContext.Provider value={{ calibration, isLoading, refreshCalibration, setCalibration }}>
      {children}
    </CalibrationContext.Provider>
  );
}

export const useCalibration = () => {
  const context = useContext(CalibrationContext);
  if (context === undefined) {
    throw new Error('useCalibration phải được đặt trong CalibrationProvider');
  }
  return context;
};
