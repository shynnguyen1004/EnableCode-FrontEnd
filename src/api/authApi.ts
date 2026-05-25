import axiosClient from './axiosClient';
import { LoginResponse, RegisterRequest, ForgotPasswordRequest, ResetPasswordRequest } from '../types';

export const authApi = {
  // Authenticates a user and stores the token/user data locally upon success
  login: async (email: string, password: string) => {
    const response = await axiosClient.post<unknown, LoginResponse>('/auth/login', { email, password });

    if (response.token) {
      localStorage.setItem('accessToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
    }
    return response;
  },
  // Registers a new user and automatically logs them in by storing the credentials
  register: async (data: RegisterRequest) => {
    const response = await axiosClient.post<unknown, LoginResponse>('/auth/register', data);

    if (response.token) {
      localStorage.setItem('accessToken', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
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
