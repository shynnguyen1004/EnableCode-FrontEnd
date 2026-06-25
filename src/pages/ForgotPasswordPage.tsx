import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import PageScale from '../components/PageScale';
import { authApi } from '../api/authApi';
import { isAxiosError } from 'axios';

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMsg(null);
    setIsLoading(true);

    try {
      const response = await authApi.forgotPassword({ email });

      setStatusMsg({
        type: 'success',
        text: response.message || t('forgotPassword.successMsg') || 'We have sent a password reset link to your email.',
      });
      setEmail('');
    } catch (error) {
      console.error('Forgot password request failed:', error);

      if (isAxiosError(error)) {
        const backendMessage = error.response?.data?.error?.message;
        setStatusMsg({
          type: 'error',
          text:
            backendMessage ||
            t('forgotPassword.errorMsg') ||
            'Failed to send reset link. Please check your email and try again.',
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: t('forgotPassword.errorMsg') || 'An unexpected error occurred. Please try again.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageScale scale={0.75} className="login-page">
      <header className="login-header container">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="login-back group"
          style={{ background: 'transparent', border: 'none', color: '#FFF9DC', cursor: 'pointer' }}
        >
          <ArrowLeft size={28} strokeWidth={3} className="nav-icon" />
          <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{t('nav.back') || 'Back'}</span>
        </button>

        <Link to="/" className="login-logo-link" aria-label={t('brand.homeAria')}>
          <img src="/logo/TD_App_Logo.png" alt={t('brand.logoDarkAlt')} className="login-logo" />
        </Link>
      </header>

      <main className="login-main container">
        <section className="login-card">
          <div className="login-intro">
            <h1>{t('forgotPassword.title') || 'Reset Password'}</h1>
            <p>
              {t('forgotPassword.subtitle') ||
                'Enter your email address and we will send you a link to reset your password.'}
            </p>
          </div>

          {/* Khung hiển thị thông báo (Thành công / Thất bại) */}
          {statusMsg && (
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                backgroundColor: statusMsg.type === 'success' ? 'rgba(116, 162, 88, 0.1)' : 'rgba(229, 58, 54, 0.1)',
                border: `1px solid ${statusMsg.type === 'success' ? '#74A258' : '#E53A36'}`,
                color: statusMsg.type === 'success' ? '#74A258' : '#E53A36',
                textAlign: 'center',
                fontWeight: '600',
              }}
            >
              {statusMsg.text}
            </div>
          )}

          <form className="login-form" onSubmit={onSubmit}>
            <label htmlFor="email">{t('login.email') || 'Email Address'}</label>
            <input
              id="email"
              type="email"
              placeholder={t('login.emailPlaceholder') || 'Enter your email...'}
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isLoading}
              required
              style={{ marginBottom: '1.5rem' }}
            />

            <button
              type="submit"
              className="login-btn login-btn-primary group"
              disabled={isLoading}
              style={{ opacity: isLoading ? 0.7 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
            >
              <Send size={28} strokeWidth={3} className="btn-icon" />
              {isLoading
                ? t('forgotPassword.sending') || 'Sending...'
                : t('forgotPassword.sendLink') || 'Send Reset Link'}
            </button>

            <div className="login-divider">
              <span />
            </div>

            <p className="register-sign-in" style={{ marginTop: '0' }}>
              {t('forgotPassword.rememberPassword') || 'Remember your password?'}{' '}
              <Link to="/login" className="register-sign-in-link">
                {t('login.login') || 'Login'}
              </Link>
            </p>
          </form>
        </section>
      </main>
    </PageScale>
  );
}
