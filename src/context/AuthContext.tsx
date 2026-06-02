import { createContext, useContext, useState, ReactNode } from 'react';
import type { User } from '../lib/types';

interface AuthContextType {
  isLoggedIn: boolean;
  token: string | null;
  user: User | null;
  login: (token: string, userData: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('accessToken');
  });

  const [user, setUser] = useState<User | null>(() => {
    try {
      const storedUser = localStorage.getItem('user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  const login = (newToken: string, userData: User) => {
    setToken(newToken);
    setUser(userData);

    localStorage.setItem('accessToken', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    setToken(null);
    setUser(null);

    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');

    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn: !!token, token, user, login, logout }}>{children}</AuthContext.Provider>
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
