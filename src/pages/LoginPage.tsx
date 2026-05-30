import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogIn, Eye } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { authApi } from '../api/authApi';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { login } = useAuth();

  // State definitions for form inputs and UI feedback
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      // 1. Gọi API (Dòng này lúc nãy bạn lỡ tay xóa mất)
      const response = await authApi.login(email, password);

      // 2. Định nghĩa kiểu dữ liệu cho response trả về từ Axios Client
      const payload = response as unknown as {
        accessToken: string;
        user: Record<string, unknown>;
      };

      // 3. Lấy dữ liệu
      const { accessToken, user } = payload;

      // 4. Lưu vào Context và LocalStorage
      if (accessToken) {
        login(accessToken);
        localStorage.setItem('user', JSON.stringify(user));
      }

      // 5. Chuyển hướng
      navigate('/lessons');
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      setErrorMsg(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <header className="login-header container">
        <Link to="/" className="login-back group">
          <ArrowLeft size={28} strokeWidth={3} className="nav-icon" />
          <span>{t('nav.back')}</span>
        </Link>

        <Link to="/" className="login-logo-link" aria-label={t('brand.homeAria')}>
          <img src="/logo/TD_App_Logo.png" alt={t('brand.logoDarkAlt')} className="login-logo" />
        </Link>
      </header>

      <main className="login-main container">
        <section className="login-card">
          <div className="login-intro">
            <h1>{t('login.welcome')}</h1>
            <p>{t('login.subtitle')}</p>
          </div>

          {errorMsg && (
            <p style={{ color: '#ff4d4f', textAlign: 'center', fontWeight: 'bold', marginBottom: '1rem' }}>
              {errorMsg}
            </p>
          )}

          <form className="login-form" onSubmit={onSubmit}>
            <label htmlFor="email">{t('login.email')}</label>
            <input
              id="email"
              type="email"
              placeholder={t('login.emailPlaceholder')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />

            <label htmlFor="password">{t('login.password')}</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isLoading}
              required
            />

            <button
              type="submit"
              className="login-btn login-btn-primary group"
              disabled={isLoading}
              style={{ opacity: isLoading ? 0.7 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
            >
              <LogIn size={32} strokeWidth={3} className="btn-icon" />
              {isLoading ? 'Processing...' : t('login.login')}
            </button>

            <div className="login-divider">
              <span />
              <strong>{t('login.or')}</strong>
              <span />
            </div>

            <button type="button" className="login-btn login-btn-secondary group">
              <Eye size={32} strokeWidth={3} className="btn-icon" />
              {t('login.eyeScan')}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
