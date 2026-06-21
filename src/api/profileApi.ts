import axiosClient from './axiosClient';
import type {
  UserProfileResponse,
  UserProfileApiResponse,
  UserStats,
  UserStatsApiResponse,
  Calibration,
  CalibrationApiResponse,
  UpdateCalibrationRequest,
  UpdateProfileRequest,
  MessageResponse,
} from '../lib/types';

export const profileApi = {
  getProfile: async (): Promise<UserProfileResponse> => {
    const response = await axiosClient.get<unknown, UserProfileApiResponse>('/users/profile');
    return response.user;
  },

  updateProfile: async (data: UpdateProfileRequest): Promise<UserProfileResponse> => {
    const response = await axiosClient.put<unknown, UserProfileApiResponse>('/users/profile', data);
    return response.user;
  },

  deleteAccount: () => axiosClient.delete<unknown, MessageResponse>('/users/profile'),

  getUserStats: async (): Promise<UserStats> => {
    const response = await axiosClient.get<unknown, UserStatsApiResponse>('/users/stats');
    return response.stats;
  },

  getCalibration: async (): Promise<Calibration> => {
    const response = await axiosClient.get<unknown, CalibrationApiResponse>('/users/calibration');
    return response.calibration;
  },

  updateCalibration: async (data: UpdateCalibrationRequest): Promise<Calibration> => {
    const response = await axiosClient.put<unknown, CalibrationApiResponse>('/users/calibration', data);
    return response.calibration;
  },
};
