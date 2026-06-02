// Defines the structure of a registered user
export interface User {
  _id: string;
  email: string;
  name: string;
  role: 'student' | 'teacher' | 'admin';
  avatar?: string;
  total_score?: number;
  lessons_completed?: number;
  streak?: number;
  level?: number;
  last_active_date?: string;
  created_at?: string;
  updated_at?: string;
}

// Response payload after a successful login or registration
export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
}

// Payload required to register a new account
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: 'student' | 'teacher' | 'admin';
  avatar?: string;
}

// Payload to request a password reset link
export interface ForgotPasswordRequest {
  email: string;
}

// Payload to set a new password using the provided token
export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}
