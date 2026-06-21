import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { profileApi } from '../api/profileApi';
import type { UserProfileResponse } from '../lib/types';
import { useI18n } from '../i18n/I18nProvider';

/* ─── Inline SVG Icons ─── */
const CheckCircleIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="14" r="12" stroke="#3b5a28" strokeWidth="2.5" fill="none" />
    <path d="M9 14.5L12.5 18L19 11" stroke="#3b5a28" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const BadgeIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="11" r="7" stroke="#ff7700" strokeWidth="2.5" fill="none" />
    <path
      d="M10 17L8 25L14 22L20 25L18 17"
      stroke="#ff7700"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const StreakIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="14" r="10" stroke="#3b5a28" strokeWidth="2.5" fill="none" />
    <circle cx="14" cy="14" r="4" stroke="#3b5a28" strokeWidth="2" fill="none" />
    <circle cx="14" cy="14" r="1.5" fill="#3b5a28" />
  </svg>
);

const EyeSettingsIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path
      d="M16 7C9 7 3 16 3 16C3 16 9 25 16 25C23 25 29 16 29 16C29 16 23 7 16 7Z"
      stroke="#272727"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <circle cx="16" cy="16" r="5" stroke="#272727" strokeWidth="2.5" fill="none" />
    <circle cx="16" cy="16" r="2" fill="#272727" />
  </svg>
);

const CalibrateIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="8" stroke="#fff" strokeWidth="2" fill="none" />
    <circle cx="12" cy="12" r="3" stroke="#fff" strokeWidth="2" fill="none" />
    <circle cx="12" cy="12" r="1" fill="#fff" />
  </svg>
);

export default function SettingsPage() {
  const { isLoggedIn } = useAuth();
  const { t } = useI18n();

  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) return;

    const fetchSettingsData = async () => {
      setIsLoading(true);
      try {
        const profileRes = await profileApi.getProfile();
        setProfileData(profileRes);
      } catch (error) {
        console.error('Error fetching settings data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettingsData();
  }, [isLoggedIn]);

  const getInitials = (name: string) => {
    if (!name) return 'GU';
    const nameParts = name.split(' ');
    if (nameParts.length >= 2) {
      return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading || !profileData) {
    return (
      <div
        className="settings-page"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}
      >
        <p style={{ color: '#666', fontSize: '1.2rem', fontWeight: 500 }}>Loading settings...</p>
      </div>
    );
  }

  const memberSinceStr = profileData.createdAt
    ? new Date(profileData.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '...';

  return (
    <div className="settings-page">
      <header className="settings-topbar">
        <Link to="/lessons" className="workspace-icon-btn" aria-label="Back to lessons">
          ←
        </Link>
        <h1>Profile & Settings</h1>
      </header>

      <div className="settings-main">
        <aside className="settings-profile">
          <div className="profile-head">
            <div className="avatar-placeholder">{getInitials(profileData.name || '')}</div>
            <div>
              <h2>{profileData.name?.toUpperCase() || 'GUEST USER'}</h2>
              <p>
                Member since {memberSinceStr} • Level {profileData.level || 1} Explorer
              </p>
            </div>
          </div>

          <div className="stats-grid">
            <article>
              <div className="stat-icon">
                <CheckCircleIcon />
              </div>
              <strong>{profileData.lessonsCompleted || 0}</strong>
              <span>EXERCISES</span>
            </article>
            <article>
              <div className="stat-icon">
                <BadgeIcon />
              </div>
              <strong>{0}</strong>
              <span>BADGES</span>
            </article>
            <article className="wide">
              <div className="stat-icon">
                <StreakIcon />
              </div>
              <strong>{profileData.streak || 0} Days</strong>
              <span>CURRENT LEARNING STREAK</span>
            </article>
          </div>
        </aside>

        <main className="settings-controls">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="settings-heading-icon">
              <EyeSettingsIcon />
            </span>
            {t('settings.eyeTrackingTitle')}
          </h3>

          <section className="control-card">
            <h4>{t('settings.calibrationTitle')}</h4>
            <p className="control-desc">{t('settings.calibrationBody')}</p>

            <Link
              to="/calibration"
              className="settings-action-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                textDecoration: 'none',
                background: 'var(--accent-orange)',
                color: '#fff',
                padding: '12px 24px',
                borderRadius: '16px',
                fontWeight: 'bold',
              }}
            >
              <CalibrateIcon />
              {t('settings.startCalibration')}
            </Link>
          </section>
        </main>
      </div>
    </div>
  );
}
