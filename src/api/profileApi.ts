import axiosClient from './axiosClient';
import { Calibration, CalibrationBounds, CalibrationPreferences } from '../types';

export const profileApi = {
  // Fetches the live gamified statistics for the current user
  getMe: () => {
    return axiosClient.get<{ _id: string; name: string; email: string; created_at: string }>('/users/me');
  },
  getUserStats: () => {
    return axiosClient.get<{ total_score: number; streak: number; lessons_completed: number; level: number }>(
      '/users/stats',
    );
  },

  // Retrieves personalized face mesh boundaries and gesture preferences from the calibrations schema
  getCalibration: () => {
    return axiosClient.get<Calibration>('/users/calibration');
  },

  // Updates the AI gesture tracking settings (e.g., bounds, gestures mapping) in the database
  updateCalibration: (data: { bounds: CalibrationBounds; preferences: CalibrationPreferences }) => {
    return axiosClient.put<Calibration>('/users/calibration', data);
  },
};
