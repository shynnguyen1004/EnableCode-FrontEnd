import { Link, useNavigate } from 'react-router-dom';
import { Eye, MousePointerSquareDashed, BookOpenCheck, ArrowRight, Loader2 } from 'lucide-react';
import { useState } from 'react';
import FaceControlToggle from '../components/FaceControlToggle';
import PageScale from '../components/PageScale';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/authApi';
import { profileApi } from '../api/profileApi'; // -> Thêm API
import { useCalibration } from '../context/CalibrationContext';

export default function HomePage() {
  const { t } = useI18n();
  const { isLoggedIn, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCheckingStart, setIsCheckingStart] = useState(false); // -> Thêm state loading cho nút Get Started

  const navigate = useNavigate();

  // Lấy thêm hàm setCalibration để đồng bộ dữ liệu nếu cần
  const { calibration, setCalibration } = useCalibration();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Failed to logout from server:', error);
    } finally {
      setIsLoggingOut(false);
      logout();
      navigate('/');
    }
  };

  // Logic kiểm tra khi người dùng bấm Get Started
  const handleGetStartedClick = async (e: React.MouseEvent) => {
    e.preventDefault(); // Chặn việc chuyển trang ngay lập tức của thẻ Link

    if (!isLoggedIn) {
      navigate('/login');
      return;
    }

    // Nếu Context đã có dữ liệu (API load kịp) -> Phóng thẳng tới trang học
    if (calibration) {
      navigate('/lessons');
      return;
    }

    // Nếu Context rỗng (có thể do load chậm hoặc chưa calibrate thật), gọi API để chắc chắn 100%
    setIsCheckingStart(true);
    try {
      const data = await profileApi.getCalibration();
      setCalibration(data); // Cập nhật lại Context
      navigate('/lessons'); // Đã có dữ liệu thì vào lessons
    } catch {
      // API báo lỗi 404 (chưa calibrate) -> Bắt đi calibrate
      navigate('/calibration');
    } finally {
      setIsCheckingStart(false);
    }
  };

  const features = [
    {
      title: t('home.featureEyeTitle'),
      body: t('home.featureEyeBody'),
      icon: <Eye size={36} strokeWidth={2.5} color="#fff" />,
      theme: 'accent-green',
    },
    {
      title: t('home.featureDragTitle'),
      body: t('home.featureDragBody'),
      icon: <MousePointerSquareDashed size={36} strokeWidth={2.5} color="#fff" />,
      theme: 'accent-light-green',
    },
    {
      title: t('home.featureLearnTitle'),
      body: t('home.featureLearnBody'),
      icon: <BookOpenCheck size={36} strokeWidth={2.5} color="#fff" />,
      theme: 'accent-orange',
    },
  ];

  return (
    <PageScale scale={1.1} className="home-wrap">
      <header className="top-nav container">
        <Link to="/" className="brand-link" aria-label={t('brand.homeAria')}>
          <img src="/logo/TL_App_Logo.png" alt={t('brand.logoLightAlt')} className="brand-logo" />
        </Link>

        <nav className="menu">
          <a href="#about" className="btn btn-ghost">
            {t('nav.about')}
          </a>

          {isLoggedIn ? (
            <>
              <Link to="/settings" className="btn btn-ghost">
                {t('nav.profile') || 'Profile'}
              </Link>
              <button
                onClick={handleLogout}
                className="btn btn-primary"
                style={{
                  cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                disabled={isLoggingOut}
              >
                {isLoggingOut && <Loader2 size={18} className="animate-spin" />}
                {t('nav.logOut') || 'Log Out'}
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-primary">
              {t('nav.logIn')}
            </Link>
          )}
        </nav>
      </header>

      <main className="hero container">
        <h1>
          {t('home.heroTitle')} <span>{t('home.heroTitleHighlight')}</span>
        </h1>
        <p>{t('home.heroSubtitle')}</p>

        <div className="hero-actions">
          <FaceControlToggle />

          {/* Nút Get Started đã được nâng cấp */}
          <Link
            to="#"
            onClick={handleGetStartedClick}
            className="btn btn-primary hero-cta group"
            style={{
              pointerEvents: isCheckingStart ? 'none' : 'auto',
              opacity: isCheckingStart ? 0.8 : 1,
            }}
          >
            {isCheckingStart ? (
              <>
                <Loader2 size={24} className="animate-spin mr-2" style={{ marginRight: '8px' }} />
                Checking...
              </>
            ) : (
              <>
                {t('home.getStarted')}
                <ArrowRight size={32} className="hero-arrow" strokeWidth={3} style={{ marginLeft: '12px' }} />
              </>
            )}
          </Link>
        </div>
      </main>

      <section id="features" className="features-section">
        <div className="container">
          <h2>
            {t('home.featuresTitle')} <span>{t('home.featuresTitleHighlight')}</span>
          </h2>
          <div className="feature-grid">
            {features.map(feature => (
              <article key={feature.title} className={`feature-card ${feature.theme}`}>
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer id="about" className="site-footer">
        <div className="container footer-inner">
          <Link to="/" className="footer-brand-link" aria-label={t('brand.homeAria')}>
            <img src="/logo/TD_App_Logo.png" alt={t('brand.logoDarkAlt')} className="footer-logo" />
          </Link>
        </div>
      </footer>
    </PageScale>
  );
}
