import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, KeyRound, CheckCircle, Loader2 } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import PageScale from '../components/PageScale';
import { authApi } from '../api/authApi';
import { isAxiosError } from 'axios';

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  // Lấy token từ URL (ví dụ: /reset-password?token=123456)
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMsg(null);

    // Kiểm tra dữ liệu đầu vào cơ bản
    if (!token) {
      setStatusMsg({
        type: 'error',
        text: t('resetPassword.missingToken') || 'Invalid or missing reset token. Please request a new link.',
      });
      return;
    }

    if (password !== confirmPassword) {
      setStatusMsg({ type: 'error', text: t('resetPassword.passwordMismatch') || 'Passwords do not match!' });
      return;
    }

    if (password.length < 6) {
      setStatusMsg({
        type: 'error',
        text: t('resetPassword.passwordTooShort') || 'Password must be at least 6 characters.',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Gọi API reset password dựa theo OpenAPI spec
      const response = await authApi.resetPassword({ token, password });

      setStatusMsg({
        type: 'success',
        text: response.message || t('resetPassword.successMsg') || 'Password reset successfully!',
      });
      setIsSuccess(true); // Đánh dấu thành công để ẩn form nhập liệu
    } catch (error) {
      console.error('Reset password failed:', error);

      if (isAxiosError(error)) {
        const backendMessage = error.response?.data?.error?.message;
        setStatusMsg({
          type: 'error',
          text: backendMessage || t('resetPassword.errorMsg') || 'Failed to reset password. The link might be expired.',
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: t('resetPassword.errorMsg') || 'An unexpected error occurred. Please try again.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageScale scale={0.75} className="login-page">
      <header className="login-header container">
        {/* Nút Back chỉ hiện khi chưa reset thành công */}
        {!isSuccess && (
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="login-back group"
            style={{ background: 'transparent', border: 'none', color: '#FFF9DC', cursor: 'pointer' }}
          >
            <ArrowLeft size={28} strokeWidth={3} className="nav-icon" />
            <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>{t('nav.back') || 'Back to Login'}</span>
          </button>
        )}

        <Link to="/" className="login-logo-link" aria-label={t('brand.homeAria')}>
          <img src="/logo/TD_App_Logo.png" alt={t('brand.logoDarkAlt')} className="login-logo" />
        </Link>
      </header>

      <main className="login-main container">
        <section className="login-card">
          <div className="login-intro">
            <h1>{t('resetPassword.title') || 'Create New Password'}</h1>
            <p>
              {isSuccess
                ? t('resetPassword.successSubtitle') || 'Your password has been changed successfully.'
                : t('resetPassword.subtitle') || 'Please enter your new password below.'}
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

          {/* Cảnh báo nếu link không có token (người dùng tự gõ link) */}
          {!token && !isSuccess && (
            <div style={{ textAlign: 'center', color: '#ff7700', marginBottom: '1.5rem' }}>
              <p>{t('resetPassword.noTokenWarning') || 'No reset token found in the URL.'}</p>
            </div>
          )}

          {/* GIAO DIỆN 1: Nếu Reset THÀNH CÔNG -> Ẩn form, hiện nút đi tới trang Đăng nhập 
            GIAO DIỆN 2: Nếu chưa thành công -> Hiện Form nhập mật khẩu mới
          */}
          {isSuccess ? (
            <button
              onClick={() => navigate('/login')}
              className="login-btn login-btn-primary group"
              style={{ background: '#74A258', borderColor: '#FFF9DC' }}
            >
              <CheckCircle size={32} strokeWidth={3} className="btn-icon" />
              {t('resetPassword.goToLogin') || 'Go to Login'}
            </button>
          ) : (
            <form className="login-form" onSubmit={onSubmit}>
              <label htmlFor="new-password">{t('resetPassword.newPassword') || 'New Password'}</label>
              <input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isLoading}
                required
                style={{ marginBottom: '1rem' }}
              />

              <label htmlFor="confirm-password">{t('resetPassword.confirmPassword') || 'Confirm New Password'}</label>
              <input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                required
                style={{ marginBottom: '2rem' }}
              />

              <button
                type="submit"
                className="login-btn login-btn-primary group"
                disabled={isLoading || !token} // Khóa nút nếu đang load hoặc không có token
                style={{
                  opacity: isLoading || !token ? 0.7 : 1,
                  cursor: isLoading || !token ? 'not-allowed' : 'pointer',
                }}
              >
                {isLoading ? (
                  <Loader2 size={32} strokeWidth={3} className="btn-icon animate-spin" />
                ) : (
                  <KeyRound size={32} strokeWidth={3} className="btn-icon" />
                )}
                {isLoading ? t('resetPassword.saving') || 'Saving...' : t('resetPassword.submit') || 'Reset Password'}
              </button>
            </form>
          )}
        </section>
      </main>
    </PageScale>
  );
}
