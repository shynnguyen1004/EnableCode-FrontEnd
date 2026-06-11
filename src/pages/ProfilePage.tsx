import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Target, Award, MousePointer2, Eye, SlidersHorizontal } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

function BrutalistSlider({
  value,
  onChange,
  fillClass,
  icon,
}: {
  value: number;
  onChange: (value: number) => void;
  fillClass: 'profile-slider-fill--green' | 'profile-slider-fill--light-green';
  icon: ReactNode;
}) {
  return (
    <div className="profile-brutal-slider">
      <input
        type="range"
        min={1}
        max={100}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        aria-valuenow={value}
        aria-valuemin={1}
        aria-valuemax={100}
      />
      <div className="profile-brutal-slider-track" />
      <div className={`profile-brutal-slider-fill ${fillClass}`} style={{ width: `${value}%` }} />
      <div className="profile-brutal-slider-thumb" style={{ left: `calc(${value}% - 36px)` }}>
        {icon}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { t } = useI18n();
  const [sensitivity, setSensitivity] = useState(75);
  const [dwellTime, setDwellTime] = useState(40);
  const [visualFeedback, setVisualFeedback] = useState(true);

  const [currentUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        const date = new Date(parsedUser.createdAt || new Date());
        const formattedDate = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        return {
          name: parsedUser.name || 'Guest',
          level: parsedUser.level || 1,
          streak: parsedUser.streak || 0,
          lessonsCompleted: parsedUser.lessonsCompleted || 0,
          badges: parsedUser.badges || 0,
          memberSince: formattedDate,
        };
      } catch (error) {
        console.error('Failed to read user from storage:', error);
      }
    }

    return {
      name: 'Guest User',
      level: 1,
      streak: 0,
      lessonsCompleted: 0,
      badges: 0,
      memberSince: '...',
    };
  });

  return (
    <div className="profile-page">
      <header className="profile-topbar">
        <Link to="/lessons" className="profile-back-btn" aria-label={t('nav.backToLessons')}>
          <ArrowLeft size={32} strokeWidth={3} />
        </Link>
        <h1>{t('settings.title')}</h1>
        <div className="profile-topbar-spacer" />
      </header>

      <div className="profile-main">
        <aside className="profile-sidebar">
          <div className="profile-user-info">
            <div className="profile-avatar-wrap">
              <img src="/images/profilePicture.jpeg" alt={t('settings.avatarAlt')} className="profile-avatar-img" />
            </div>
            <div className="profile-details">
              <h2>{currentUser.name.toUpperCase()}</h2>
              <p>
                {t('settings.memberSincePrefix')} {currentUser.memberSince} • {t('settings.levelPrefix')}{' '}
                {currentUser.level} {t('settings.explorer')}
              </p>
            </div>
          </div>

          <div className="profile-stats-grid">
            <article className="profile-stat-card" tabIndex={0}>
              <CheckCircle size={52} strokeWidth={3} className="icon-green" />
              <strong>{currentUser.lessonsCompleted}</strong>
              <span>{t('settings.exercises')}</span>
            </article>
            <article className="profile-stat-card" tabIndex={0}>
              <Award size={52} strokeWidth={3} className="icon-orange" />
              <strong>{currentUser.badges}</strong>
              <span>{t('settings.badges')}</span>
            </article>
            <article className="profile-stat-card wide" tabIndex={0}>
              <Target size={52} strokeWidth={3} className="icon-light-green" />
              <strong>
                {currentUser.streak} {t('settings.streakDays')}
              </strong>
              <span>{t('settings.streak')}</span>
            </article>
          </div>
        </aside>

        <main className="profile-controls">
          <div className="profile-controls-inner">
            <div className="profile-controls-header">
              <div className="profile-heading-icon-wrap">
                <Eye size={44} strokeWidth={2.5} color="#FFF9DC" />
              </div>
              <h2>{t('settings.eyeTrackingTitle')}</h2>
            </div>

            <div className="profile-settings-stack">
              <section className="profile-calibration-section">
                <h4>{t('settings.calibrationTitle')}</h4>
                <p>{t('settings.calibrationBody')}</p>
                <Link to="/calibration" className="profile-action-btn group">
                  <Target size={44} strokeWidth={3} color="#FFF9DC" className="profile-action-icon" />
                  {t('settings.startCalibration')}
                </Link>
              </section>

              <section className="profile-control-card">
                <div className="profile-control-row">
                  <h4>{t('settings.sensitivityTitle')}</h4>
                  <span className="profile-badge-orange">{sensitivity}%</span>
                </div>
                <p>{t('settings.sensitivityBody')}</p>
                <BrutalistSlider
                  value={sensitivity}
                  onChange={setSensitivity}
                  fillClass="profile-slider-fill--green"
                  icon={<SlidersHorizontal size={32} strokeWidth={3} color="#FFF9DC" />}
                />
              </section>

              <section className="profile-control-card">
                <div className="profile-control-row">
                  <h4>{t('settings.dwellTitle')}</h4>
                  <span className="profile-badge-green">{(dwellTime / 10).toFixed(1)}s</span>
                </div>
                <p>{t('settings.dwellBody')}</p>
                <BrutalistSlider
                  value={dwellTime}
                  onChange={setDwellTime}
                  fillClass="profile-slider-fill--light-green"
                  icon={<MousePointer2 size={32} strokeWidth={3} color="#FFF9DC" />}
                />
              </section>

              <button
                type="button"
                className="profile-toggle-card"
                role="switch"
                aria-checked={visualFeedback}
                onClick={() => setVisualFeedback(prev => !prev)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setVisualFeedback(prev => !prev);
                  }
                }}
              >
                <div className="profile-toggle-copy">
                  <h4>{t('settings.visualFeedbackTitle')}</h4>
                  <p>{t('settings.visualFeedbackBody')}</p>
                </div>
                <div className={`profile-toggle-switch${visualFeedback ? ' profile-toggle-switch--on' : ''}`}>
                  <div className="profile-toggle-knob">
                    {visualFeedback && <CheckCircle size={28} strokeWidth={4} className="icon-green" />}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
