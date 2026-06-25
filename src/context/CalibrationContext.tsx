import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import type { Calibration } from '../lib/types';
import { profileApi } from '../api/profileApi';

interface CalibrationContextType {
  calibration: Calibration | null;
  isLoading: boolean;
}

const CalibrationContext = createContext<CalibrationContextType | undefined>(undefined);

interface CalibrationProviderProps {
  children: ReactNode;
}

export function CalibrationProvider({ children }: CalibrationProviderProps) {
  const { isLoggedIn, accessToken } = useAuth();
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    // Nếu chưa đăng nhập hoặc không có token, xóa dữ liệu cũ một cách an toàn bằng setTimeout
    if (!isLoggedIn || !accessToken) {
      const timer = setTimeout(() => {
        setCalibration(null);
      }, 0);
      return () => clearTimeout(timer); // Dọn dẹp timer nếu component unmount
    }

    // Khai báo flag hủy để tránh race-condition (dữ liệu API cũ đè lên dữ liệu mới)
    let isMounted = true;

    const fetchCalibrationData = async () => {
      setIsLoading(true);
      try {
        const response = await profileApi.getCalibration();
        if (isMounted) setCalibration(response);
      } catch (error) {
        console.error('Lỗi khi tải dữ liệu cấu hình khuôn mặt:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchCalibrationData();

    // Cleanup function để hủy hành động gọi API cũ nếu token thay đổi liên tục
    return () => {
      isMounted = false;
    };
  }, [isLoggedIn, accessToken]);

  return <CalibrationContext.Provider value={{ calibration, isLoading }}>{children}</CalibrationContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useCalibration = () => {
  const context = useContext(CalibrationContext);
  if (context === undefined) {
    throw new Error('useCalibration phải được đặt trong CalibrationProvider');
  }
  return context;
};
