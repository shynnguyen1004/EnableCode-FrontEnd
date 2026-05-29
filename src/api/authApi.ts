import axiosClient from './axiosClient';
import { LoginResponse, RegisterRequest, ForgotPasswordRequest, ResetPasswordRequest } from '../types';

// Intercept and extend the LoginResponse type to accommodate the real backend field 'accessToken'
type ActualLoginResponse = LoginResponse & { accessToken?: string };

export const authApi = {
  // Authenticates a user and stores the accessToken/user data locally upon success
  login: async (email: string, password: string) => {
    const response = await axiosClient.post<unknown, ActualLoginResponse>('/auth/login', { email, password });

    // Type-safe safeguard: extracts payload and accounts for optional Axios wrapping without 'any'
    const payload = (response as { data?: ActualLoginResponse }).data || response;

    if (payload.accessToken) {
      localStorage.setItem('accessToken', payload.accessToken);
      localStorage.setItem('user', JSON.stringify(payload.user));
    }
    return response;
  },

  // Registers a new user and automatically logs them in using the unified accessToken
  register: async (data: RegisterRequest) => {
    const response = await axiosClient.post<unknown, ActualLoginResponse>('/auth/register', data);

    const payload = (response as { data?: ActualLoginResponse }).data || response;

    if (payload.accessToken) {
      localStorage.setItem('accessToken', payload.accessToken);
      localStorage.setItem('user', JSON.stringify(payload.user));
    }
    return response;
  },

  // Triggers an email containing a password reset link
  forgotPassword: (data: ForgotPasswordRequest) => {
    return axiosClient.post<unknown, { success: boolean; message: string }>('/auth/forgot-password', data);
  },

  // Resets the user's password using the token sent to their email
  resetPassword: (data: ResetPasswordRequest) => {
    return axiosClient.post<unknown, { success: boolean; message: string }>('/auth/reset-password', data);
  },
};
