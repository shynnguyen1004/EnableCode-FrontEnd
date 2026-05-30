import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogIn, Eye } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { authApi } from '../api/authApi';

export default function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate(); // Hook for programmatic navigation

  // State definitions for form inputs and UI feedback
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent default form submission behavior
    setErrorMsg(''); // Clear previous error messages
    setIsLoading(true); // Enable loading state

    try {
      // Authenticate user via API (authApi automatically handles localStorage now)
      await authApi.login(email, password);

      // Navigate to the lessons dashboard upon success
      navigate('/lessons');
    } catch (error) {
      // Cast the error object to a custom type to satisfy TypeScript without using 'any'
      const err = error as { response?: { data?: { message?: string } } };

      // Extract and display the error message from the backend response
      setErrorMsg(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      // Ensure loading state is disabled regardless of outcome
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

          {/* Display error message if authentication fails */}
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
              value={email} // Bind state to input value
              onChange={e => setEmail(e.target.value)} // Update state on change
              disabled={isLoading} // Disable input during API call
              required
            />

            <label htmlFor="password">{t('login.password')}</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password} // Bind state to input value
              onChange={e => setPassword(e.target.value)} // Update state on change
              disabled={isLoading} // Disable input during API call
              required
            />

            {/* Replaced <Link> with a submit <button> to trigger the form action */}
            <button
              type="submit"
              className="login-btn login-btn-primary group"
              disabled={isLoading}
              style={{ opacity: isLoading ? 0.7 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}>
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
