import { createContext, useContext, useState, ReactNode } from 'react';

// Định nghĩa kiểu dữ liệu cho Context
interface AuthContextType {
  isLoggedIn: boolean;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
}

// Khởi tạo Context ban đầu với giá trị undefined
const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Component Provider để bọc toàn bộ ứng dụng
export function AuthProvider({ children }: AuthProviderProps) {
  // Đọc token từ localStorage ngay khi khởi tạo ứng dụng
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('accessToken');
  });

  // Hàm xử lý khi đăng nhập thành công
  const login = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem('accessToken', newToken);
  };

  // Hàm xử lý khi đăng xuất
  const logout = () => {
    setToken(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user'); // Xóa luôn thông tin user lưu kèm lúc login
    window.location.href = '/'; // Chuyển hướng về trang chủ một cách sạch sẽ
  };

  return <AuthContext.Provider value={{ isLoggedIn: !!token, token, login, logout }}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
