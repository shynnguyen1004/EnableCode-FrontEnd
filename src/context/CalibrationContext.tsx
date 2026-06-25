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

interface CalibrationProviderProps {
  children: ReactNode;
}

export function CalibrationProvider({ children }: CalibrationProviderProps) {
  const { isLoggedIn, accessToken } = useAuth();
  const [calibration, setCalibration] = useState<Calibration | null>(null);
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
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn, accessToken]);

  useEffect(() => {
    // Nếu chưa đăng nhập hoặc không có token, xóa dữ liệu cũ một cách an toàn
    if (!isLoggedIn || !accessToken) {
      const timer = setTimeout(() => {
        setCalibration(null);
      }, 0);
      return () => clearTimeout(timer);
    }

    // Tự động chạy khi user đăng nhập thành công
    // Tránh gọi setState đồng bộ trực tiếp trong Effect bằng setTimeout
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
