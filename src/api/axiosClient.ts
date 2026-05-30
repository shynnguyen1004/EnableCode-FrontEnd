import axios from 'axios';

// Create a base Axios instance using the environment variable for the URL
const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor: Automatically attach the JWT access token to every outgoing request
axiosClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  },
);

// Response interceptor: Extract data and centrally handle authentication/authorization errors
axiosClient.interceptors.response.use(
  response => {
    return response.data;
  },
  // Handle error
  error => {
    if (error.response?.status === 401) {
      console.error('Token expired or unauthorized access!');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
    } else if (error.response?.status === 403) {
      console.error('Forbidden! You do not have permission to access this resource.');
    }

    return Promise.reject(error);
  },
);

export default axiosClient;
