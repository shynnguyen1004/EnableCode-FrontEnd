import axiosClient from './axiosClient';
import type { AuthResponse, RegisterRequest, ForgotPasswordRequest, ResetPasswordRequest } from '../lib/types';

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await axiosClient.post<unknown, AuthResponse>('/auth/login', { email, password });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (response as any).data || response;
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await axiosClient.post<unknown, AuthResponse>('/auth/register', data);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (response as any).data || response;
  },

  forgotPassword: (data: ForgotPasswordRequest) => {
    return axiosClient.post<unknown, { success: boolean; message: string }>('/auth/forgot-password', data);
  },

  resetPassword: (data: ResetPasswordRequest) => {
    return axiosClient.post<unknown, { success: boolean; message: string }>('/auth/reset-password', data);
  },
};
