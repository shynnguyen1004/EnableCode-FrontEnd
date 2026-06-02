import axiosClient from './axiosClient';
import type { User, UserStats, Calibration, UpdateCalibrationRequest } from '../lib/types';

export const profileApi = {
  getProfile: (): Promise<User> => axiosClient.get('/users/profile') as Promise<User>,

  getUserStats: (): Promise<UserStats> => axiosClient.get('/users/stats') as Promise<UserStats>,

  getCalibration: (): Promise<Calibration> => axiosClient.get('/users/calibration') as Promise<Calibration>,

  updateCalibration: (data: UpdateCalibrationRequest): Promise<Calibration> =>
    axiosClient.put('/users/calibration', data) as Promise<Calibration>,
};
