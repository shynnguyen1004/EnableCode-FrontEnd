import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserProfileResponse } from '../lib/types';

interface AuthContextType {
  isLoggedIn: boolean;
  accessToken: string | null;
  user: UserProfileResponse | null;
  login: (newAccessToken: string, userData: UserProfileResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const navigate = useNavigate();

  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return localStorage.getItem('accessToken');
  });

  const [user, setUser] = useState<UserProfileResponse | null>(() => {
    try {
      const storedUser = localStorage.getItem('user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  const login = (newAccessToken: string, userData: UserProfileResponse) => {
    setAccessToken(newAccessToken);
    setUser(userData);

    localStorage.setItem('accessToken', newAccessToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = useCallback(() => {
    setAccessToken(null);
    setUser(null);

    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');

    navigate('/login');
  }, [navigate]);

  useEffect(() => {
    const handleAuthExpired = () => {
      logout();
    };

    window.addEventListener('auth-expired', handleAuthExpired);
    return () => {
      window.removeEventListener('auth-expired', handleAuthExpired);
    };
  }, [logout]);

  return (
    <AuthContext.Provider value={{ isLoggedIn: !!accessToken, accessToken, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
