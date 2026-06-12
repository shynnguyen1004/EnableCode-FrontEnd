import axios, { InternalAxiosRequestConfig } from 'axios';

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/';

const axiosClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
  withCredentials: true,
});

axiosClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error),
);

axiosClient.interceptors.response.use(
  response => {
    return response.data;
  },
  async error => {
    const originalRequest = error.config as CustomAxiosRequestConfig;
    const status = error.response?.status;
    const backendError = error.response?.data?.error;

    if (status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const response = await axios.post(`${baseURL}/auth/refresh-token`, {}, { withCredentials: true });

        const newAccessToken = response.data?.accessToken;
        if (newAccessToken) {
          localStorage.setItem('accessToken', newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        return axiosClient(originalRequest);
      } catch (refreshError) {
        window.dispatchEvent(new Event('auth-expired'));

        error.message = backendError?.message || 'Session expired. Please log in again.';
        return Promise.reject(refreshError);
      }
    }

    if (status === 401) {
      window.dispatchEvent(new Event('auth-expired'));
      error.message = backendError?.message || 'Session expired. Please log in again.';
    } else if (status === 403) {
      console.error('Forbidden! Insufficient permissions.');
      error.message = backendError?.message || 'You do not have permission to access this feature.';
    } else if (backendError?.message) {
      error.message = backendError.message;
    }

    return Promise.reject(error);
  },
);

export default axiosClient;
