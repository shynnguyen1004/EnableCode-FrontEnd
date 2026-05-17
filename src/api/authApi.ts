import axiosClient from './axiosClient';

// Update Interface to match exactly 100% with Backend's Swagger definition
interface LoginResponse {
  success: boolean;
  token: string;
  user: {
    _id: string;
    email: string;
    name: string;
    role: string;
    avatar?: string;
    calibration_is_calibrated: boolean;
  };
}

export const authApi = {
  // Login function
  login: async (email: string, password: string) => {
    // Explicitly define the expected response type as LoginResponse
    const response = await axiosClient.post<any, LoginResponse>('/auth/login', { email, password });

    // Extract 'token' based on Swagger definition
    if (response.token) {
      // Note: The key in localStorage is still named 'accessToken' so axiosClient
      // doesn't need any changes, but we fetch it from the backend using 'response.token'
      localStorage.setItem('accessToken', response.token);

      // Optionally save user info to localStorage to easily display the name/avatar on the UI
      localStorage.setItem('user', JSON.stringify(response.user));
    }
    return response;
  },

  // Register function
  register: (data: any) => {
    return axiosClient.post('/auth/register', data);
  },
};
