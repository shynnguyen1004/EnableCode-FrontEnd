import axios from 'axios';
import axiosClient from './axiosClient';
import type {
  AuthResponse,
  RegisterRequest,
  LoginRequest,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  MessageResponse,
  ResetPasswordResponse,
  RefreshTokenResponse,
} from '../lib/types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const axiosAuth = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export const authApi = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await axiosAuth.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await axiosAuth.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  forgotPassword: async (data: ForgotPasswordRequest): Promise<ForgotPasswordResponse> => {
    const response = await axiosAuth.post<ForgotPasswordResponse>('/auth/forgot-password', data);
    return response.data;
  },

  resetPassword: async (data: ResetPasswordRequest): Promise<ResetPasswordResponse> => {
    const response = await axiosAuth.post<ResetPasswordResponse>('/auth/reset-password', data);
    return response.data;
  },

  loginByFace: async (image: string): Promise<AuthResponse> => {
    const response = await axiosAuth.post<AuthResponse>('/auth/face-login', { image });
    return response.data;
  },

  saveFaceEmbedding: async (image: string): Promise<{ success: boolean; message: string }> => {
    const response = await axiosClient.put('/auth/embedding', { image });
    return response.data;
  },

  refreshToken: async (): Promise<RefreshTokenResponse> => {
    const response = await axiosAuth.post<RefreshTokenResponse>('/auth/refresh-token');
    return response.data;
  },

  logout: () => axiosClient.post<unknown, MessageResponse>('/auth/logout'),
};
