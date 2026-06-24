import axiosClient from './axiosClient';
import type { Calibration, UpdateCalibrationRequest } from '../lib/types';

export const calibrationApi = {
  getCalibration: () => axiosClient.get<unknown, Calibration>('/users/calibration'),

  updateCalibration: (data: UpdateCalibrationRequest) =>
    axiosClient.put<unknown, Calibration>('/users/calibration', data),
};
