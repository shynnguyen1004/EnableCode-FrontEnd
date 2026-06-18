import axiosClient from './axiosClient';
import type {
  UserProfileResponse,
  UserStats,
  Calibration,
  UpdateCalibrationRequest,
  UpdateProfileRequest,
  MessageResponse,
} from '../lib/types';

export const profileApi = {
  getProfile: () => axiosClient.get<unknown, UserProfileResponse>('/users/profile'),

  updateProfile: (data: UpdateProfileRequest) => axiosClient.put<unknown, UserProfileResponse>('/users/profile', data),

  deleteAccount: () => axiosClient.delete<unknown, MessageResponse>('/users/profile'),

  getUserStats: () => axiosClient.get<unknown, UserStats>('/users/stats'),

  getCalibration: () => axiosClient.get<unknown, Calibration>('/users/calibration'),

  updateCalibration: (data: UpdateCalibrationRequest) =>
    axiosClient.put<unknown, Calibration>('/users/calibration', data),
};
