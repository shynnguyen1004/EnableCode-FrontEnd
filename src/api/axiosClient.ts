import axios from 'axios';

// Create an axios instance with default config
const axiosClient = axios.create({
  baseURL: 'http://localhost:5000/api', // Base URL from Swagger
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // Timeout if the server takes longer than 10s
});

// Request interceptor to attach the Access Token
axiosClient.interceptors.request.use(
  config => {
    // Retrieve the access token from localStorage
    const token = localStorage.getItem('accessToken');

    // If token exists, attach it to the Authorization header
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  },
);

// Response interceptor to unwrap data and handle token expiration
axiosClient.interceptors.response.use(
  response => {
    // Extract and return only the 'data' part from the response
    return response.data;
  },
  error => {
    // Centralized error handling
    if (error.response?.status === 401) {
      console.error('🔒 Token expired or unauthorized access!');

      // Remove expired token (User needs to re-login since Refresh Token is not yet implemented in M3A)
      localStorage.removeItem('accessToken');
    }
    return Promise.reject(error);
  },
);

export default axiosClient;
