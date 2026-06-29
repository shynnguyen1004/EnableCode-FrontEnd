import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, ScanFace } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { authApi } from '../api/authApi';
import PageScale from '../components/PageScale';
import { isAxiosError } from 'axios';

export default function RegisterPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMsg('');

    if (password !== confirmPassword) {
      setErrorMsg(t('register.passwordMismatch') || 'Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Gọi API Đăng ký
      const response = await authApi.register({ name, email, password, role: 'student' });

      // 2. Nếu đăng ký thành công -> Đẩy về thẳng trang Login
      if (response.success || response.user) {
        // Truyền thêm một message nhỏ để trang Login có thể hiển thị thông báo "Đăng ký thành công" (nếu bạn muốn)
        navigate('/login', { state: { message: 'Đăng ký thành công! Vui lòng đăng nhập.' } });
      } else {
        setErrorMsg(t('register.failed') || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration failed:', error);

      if (isAxiosError(error)) {
        const backendMessage = error.response?.data?.error?.message || error.response?.data?.message;
        setErrorMsg(backendMessage || t('register.failed') || 'Registration failed. Please try again.');
      } else {
        setErrorMsg(t('register.failed') || 'An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageScale scale={0.75} className="login-page">
      <header className="login-header container">
        <Link to="/login" className="login-back group">
          <ArrowLeft size={28} strokeWidth={3} className="nav-icon" />
          <span>{t('nav.back')}</span>
        </Link>

        <Link to="/" className="login-logo-link" aria-label={t('brand.homeAria')}>
          <img src="/logo/TD_App_Logo.png" alt={t('brand.logoDarkAlt')} className="login-logo" />
        </Link>
      </header>

      <main className="login-main container">
        <section className="login-card register-card">
          <div className="login-intro">
            <h1>{t('register.title')}</h1>
            <p>{t('register.subtitle')}</p>
          </div>

          {errorMsg && <p className="register-error">{errorMsg}</p>}

          <form className="login-form register-form" onSubmit={onSubmit}>
            <label htmlFor="name">{t('register.fullName')}</label>
            <input
              id="name"
              type="text"
              placeholder={t('register.namePlaceholder')}
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isLoading}
              required
            />

            <label htmlFor="email">{t('register.email')}</label>
            <input
              id="email"
              type="email"
              placeholder={t('register.emailPlaceholder')}
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />

            <div className="register-password-row">
              <div className="register-password-field">
                <label htmlFor="password">{t('register.password')}</label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="register-password-field">
                <label htmlFor="confirm">{t('register.confirm')}</label>
                <input
                  id="confirm"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="login-btn login-btn-primary group"
              disabled={isLoading}
              style={{ opacity: isLoading ? 0.7 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
            >
              <UserPlus size={32} strokeWidth={3} className="btn-icon" />
              {isLoading ? t('register.processing') : t('register.submit')}
            </button>

            <div className="login-divider">
              <span />
              <strong>{t('login.or')}</strong>
              <span />
            </div>

            <button
              type="button"
              className="login-btn login-btn-secondary group"
              onClick={() => navigate('/face-register')}
            >
              <ScanFace size={32} strokeWidth={3} className="btn-icon" />
              {t('register.faceScan')}
            </button>

            <p className="register-sign-in">
              {t('register.hasAccount')}{' '}
              <Link to="/login" className="register-sign-in-link">
                {t('register.signIn')}
              </Link>
            </p>
          </form>
        </section>
      </main>
    </PageScale>
  );
}
