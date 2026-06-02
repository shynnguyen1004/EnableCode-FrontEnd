import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
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
  error => {
    const status = error.response?.status;

    const backendError = error.response?.data?.error;

    if (status === 401) {
      console.error('Token expired or unauthorized access!');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      error.message = backendError?.message || 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
    } else if (status === 403) {
      console.error('Forbidden! Insufficient permissions.');
      error.message = backendError?.message || 'Bạn không có quyền truy cập tính năng này.';
    } else if (backendError?.message) {
      error.message = backendError.message;
    }
    return Promise.reject(error);
  },
);

export default axiosClient;
