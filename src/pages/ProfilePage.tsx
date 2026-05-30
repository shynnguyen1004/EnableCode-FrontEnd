import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Target, Award, Eye, SlidersHorizontal, MousePointer2, Languages } from 'lucide-react';
import LanguageToggle from '../components/LanguageToggle';
import { useI18n } from '../i18n/I18nProvider';

export default function ProfilePage() {
  const { t } = useI18n();
  const [sensitivity, setSensitivity] = useState(75);
  const [dwellTime, setDwellTime] = useState(40);

  // --- THÊM LOGIC ĐỌC DỮ LIỆU THẬT Ở ĐÂY ---
  const [currentUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);

        // Chuyển đổi ngày tháng cho đẹp
        const date = new Date(parsedUser.createdAt || new Date());
        const formattedDate = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        return {
          name: parsedUser.name || 'Guest',
          level: parsedUser.level || 1,
          streak: parsedUser.streak || 0,
          lessonsCompleted: parsedUser.lessonsCompleted || 0,
          badges: 7,
          memberSince: formattedDate,
        };
      } catch (error) {
        console.error('Lỗi khi đọc thông tin User:', error);
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
  // ------------------------------------------

  return (
    <div className="profile-page">
      <header className="profile-topbar">
        <Link to="/lessons" className="profile-back-btn" aria-label={t('nav.backToLessons')}>
          <ArrowLeft size={24} strokeWidth={3} />
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
              {/* Thay ALEX CODER bằng tên thật lấy từ API */}
              <h2>{currentUser.name.toUpperCase()}</h2>
              <p>
                {t('settings.memberSince')} {currentUser.memberSince}
              </p>
            </div>
          </div>

          <div className="profile-stats-grid">
            <article className="profile-stat-card">
              <div className="profile-stat-icon">
                <CheckCircle size={32} strokeWidth={3} className="icon-green" />
              </div>
              {/* Thay số 42 bằng số bài học đã hoàn thành */}
              <strong>{currentUser.lessonsCompleted}</strong>
              <span>{t('settings.exercises')}</span>
            </article>
            <article className="profile-stat-card">
              <div className="profile-stat-icon">
                <Award size={32} strokeWidth={3} className="icon-orange" />
              </div>
              {/* Thay số 7 bằng số badge */}
              <strong>{currentUser.badges}</strong>
              <span>{t('settings.badges')}</span>
            </article>
            <article className="profile-stat-card wide">
              <div className="profile-stat-icon">
                <Target size={32} strokeWidth={3} className="icon-light-green" />
              </div>
              {/* Thay bằng chuỗi (streak) thật */}
              <strong>{currentUser.streak}</strong>
              <span>{t('settings.streak')}</span>
            </article>
          </div>
        </aside>

        <main className="profile-controls">
          <section className="profile-language-section">
            <div className="profile-language-header">
              <div className="profile-heading-icon-wrap profile-heading-icon-wrap--language">
                <Languages size={28} strokeWidth={2.5} color="#FFF9DC" />
              </div>
              <h2>{t('settings.languageTitle')}</h2>
            </div>
            <p>{t('settings.languageSubtitle')}</p>
            <LanguageToggle />
          </section>

          <div className="profile-controls-header">
            <div className="profile-heading-icon-wrap">
              <Eye size={28} strokeWidth={2.5} color="#FFF9DC" />
            </div>
            <h2>{t('settings.eyeTrackingTitle')}</h2>
          </div>

          <section className="profile-calibration-section">
            <h4>{t('settings.calibrationTitle')}</h4>
            <p>{t('settings.calibrationBody')}</p>
            <button className="profile-action-btn" type="button">
              <Target size={24} strokeWidth={3} color="#FFF9DC" />
              {t('settings.startCalibration')}
            </button>
          </section>

          <section className="profile-control-card">
            <div className="profile-control-row">
              <h4>{t('settings.sensitivityTitle')}</h4>
              <span className="profile-badge-orange">{sensitivity}%</span>
            </div>
            <p>{t('settings.sensitivityBody')}</p>
            <div className="profile-slider-wrap">
              <input
                type="range"
                min={1}
                max={100}
                value={sensitivity}
                onChange={event => setSensitivity(Number(event.target.value))}
                style={{ '--range-progress': `${sensitivity}%` } as React.CSSProperties}
              />
              <div className="profile-range-thumb-icon" style={{ left: `calc(${sensitivity}% - 22px)` }}>
                <SlidersHorizontal size={20} strokeWidth={3} color="#FFF9DC" />
              </div>
            </div>
          </section>

          <section className="profile-control-card">
            <div className="profile-control-row">
              <h4>{t('settings.dwellTitle')}</h4>
              <span className="profile-badge-green">{(dwellTime / 10).toFixed(1)}s</span>
            </div>
            <p>{t('settings.dwellBody')}</p>
            <div className="profile-slider-wrap">
              <input
                type="range"
                min={1}
                max={100}
                value={dwellTime}
                onChange={event => setDwellTime(Number(event.target.value))}
                style={{ '--range-progress': `${dwellTime}%` } as React.CSSProperties}
              />
              <div className="profile-range-thumb-icon" style={{ left: `calc(${dwellTime}% - 22px)` }}>
                <MousePointer2 size={20} strokeWidth={3} color="#FFF9DC" />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
