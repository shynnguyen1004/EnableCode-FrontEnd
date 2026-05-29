import axiosClient from './axiosClient';
import { Calibration, CalibrationBounds, CalibrationPreferences } from '../types';

export const profileApi = {
  // Fetches the live gamified statistics for the current user
  getUserStats: () => {
    return axiosClient.get<{ total_score: number; streak: number; lessons_completed: number; level: number }>(
      '/api/users/stats',
    );
  },

  // Retrieves personalized face mesh boundaries and gesture preferences from the calibrations schema
  getCalibration: () => {
    return axiosClient.get<Calibration>('/api/users/calibration');
  },

  // Updates the AI gesture tracking settings (e.g., bounds, gestures mapping) in the database
  updateCalibration: (data: { bounds: CalibrationBounds; preferences: CalibrationPreferences }) => {
    return axiosClient.put<Calibration>('/api/users/calibration', data);
  },
};
