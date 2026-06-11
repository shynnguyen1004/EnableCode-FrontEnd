import { Link } from 'react-router-dom';
import { Eye, MousePointerSquareDashed, BookOpenCheck, ArrowRight } from 'lucide-react';
import FaceControlToggle from '../components/FaceControlToggle';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const { t } = useI18n();

  const { isLoggedIn, logout } = useAuth();

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
    <div className="home-wrap">
      <header className="top-nav container">
        <Link to="/" className="brand-link" aria-label={t('brand.homeAria')}>
          <img src="/logo/TL_App_Logo.png" alt={t('brand.logoLightAlt')} className="brand-logo" />
        </Link>

        <nav className="menu">
          <a href="#features" className="btn btn-ghost">
            {t('nav.features')}
          </a>
          <a href="#about" className="btn btn-ghost">
            {t('nav.about')}
          </a>

          {isLoggedIn ? (
            <>
              <Link to="/settings" className="btn btn-ghost">
                Profile
              </Link>
              <button onClick={logout} className="btn btn-primary" style={{ cursor: 'pointer' }}>
                Log Out
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
          <Link to="/lessons" className="btn btn-primary hero-cta group">
            {t('home.getStarted')}
            <ArrowRight size={32} className="hero-arrow" strokeWidth={3} style={{ marginLeft: '12px' }} />
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
          <div className="footer-links">
            <a href="#">{t('home.privacy')}</a>
            <a href="#">{t('home.terms')}</a>
            <a href="#">{t('home.contact')}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
