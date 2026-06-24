import axios, { InternalAxiosRequestConfig } from 'axios';

// Định nghĩa Interface cấu hình mở rộng theo style của team
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const axiosClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
  withCredentials: true, // Giữ nguyên để gửi kèm HttpOnly Cookie
});

// 1. Request Interceptor: Tự động đính kèm Access Token từ localStorage
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

// 2. Response Interceptor: Xử lý mượt mà dữ liệu trả về và tự động Refresh Token
axiosClient.interceptors.response.use(
  response => {
    return response.data; // Trả về direct data chuẩn style team
  },
  async error => {
    const originalRequest = error.config as CustomAxiosRequestConfig;
    const status = error.response?.status;
    const backendError = error.response?.data?.error;

    // Nếu lỗi 401 Unauthorized và request này chưa từng thử gửi lại (chưa retry)
    if (status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Đã hết lỗi "//" nhờ xử lý loại bỏ dấu gạch chéo ở hằng số baseURL phía trên
        const response = await axios.post(`${baseURL}/auth/refresh-token`, {}, { withCredentials: true });

        const newAccessToken = response.data?.accessToken;
        if (newAccessToken) {
          localStorage.setItem('accessToken', newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        // Gọi lại request bị lỗi ban đầu với token mới
        return axiosClient(originalRequest);
      } catch (refreshError) {
        // Bắn sự kiện thông báo phiên đăng nhập hết hạn ra toàn hệ thống
        window.dispatchEvent(new Event('auth-expired'));

        error.message = backendError?.message || 'Session expired. Please log in again.';
        return Promise.reject(refreshError);
      }
    }

    // Xử lý các mã lỗi HTTP khác theo logic hiện tại của team
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
