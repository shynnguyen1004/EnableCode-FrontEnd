export interface CalibrationBounds {
  pitch_max: number;
  pitch_min: number;
  yaw_max: number;
  yaw_min: number;
}

export interface CalibrationPreferences {
  drag_drop_gesture: string;
  run_code_gesture: string;
  cursor_smoothing?: number;
  camera_index?: number;
}

export interface Calibration {
  _id?: string;
  user_id?: string;
  bounds: CalibrationBounds;
  preferences: CalibrationPreferences;
  updated_at?: string;
}
