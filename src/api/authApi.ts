import axiosClient from './axiosClient';

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

export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: 'student' | 'teacher' | 'admin';
  avatar?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export const authApi = {
  login: async (email: string, password: string) => {
    const response = await axiosClient.post<unknown, LoginResponse>('/auth/login', { email, password });

    if (response.token) {
      localStorage.setItem('accessToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
    }
    return response;
  },

  register: (data: RegisterRequest) => {
    return axiosClient.post<unknown, LoginResponse>('/auth/register', data);
  },

  forgotPassword: (data: ForgotPasswordRequest) => {
    return axiosClient.post<unknown, { success: boolean; message: string }>('/auth/forgot-password', data);
  },

  resetPassword: (data: ResetPasswordRequest) => {
    return axiosClient.post<unknown, { success: boolean; message: string }>('/auth/reset-password', data);
  },
};
