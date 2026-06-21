// 1. TẤT CẢ IMPORT PHẢI NẰM Ở ĐÂY
import { useEffect, useState, ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  Target,
  Award,
  Eye,
  SlidersHorizontal,
  MousePointer2,
  Languages,
  Loader2,
  Save,
  AlertTriangle,
} from 'lucide-react';
import LanguageToggle from '../components/LanguageToggle';
import PageScale from '../components/PageScale';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthContext';
import { profileApi } from '../api/profileApi';
import type { UserProfileResponse, Calibration } from '../lib/types';

// 2. KHAI BÁO COMPONENT CON SAU KHI ĐÃ IMPORT XONG
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

// 3. COMPONENT CHÍNH CỦA TRANG
export default function ProfilePage() {
  const { t } = useI18n();
  const { isLoggedIn } = useAuth();

  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);
  const [calibration, setCalibration] = useState<Calibration | null>(null);

  const [sensitivity, setSensitivity] = useState(75);
  const [dwellTime, setDwellTime] = useState(40);
  const [visualFeedback, setVisualFeedback] = useState(true);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;

    const fetchProfileAndSettings = async () => {
      setIsLoading(true);
      setFetchError(false);
      try {
        const [profileRes, calibrationRes] = await Promise.all([
          profileApi.getProfile(),
          profileApi.getCalibration().catch(() => {
            console.warn('Error fetching calibration data, returning null.');
            return null; // Bỏ qua lỗi 404 của Calibration
          }),
        ]);

        setProfileData(profileRes);
        setCalibration(calibrationRes);

        if (calibrationRes?.preferences) {
          setSensitivity(calibrationRes.preferences.trackingSensitivity || 75);
          setDwellTime(calibrationRes.preferences.mouthDragThreshold || 40);
        }
      } catch (error) {
        console.error('Error fetching profile and settings:', error);
        setFetchError(true); // Đánh dấu là có lỗi nghiêm trọng khi lấy Profile
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileAndSettings();
  }, [isLoggedIn]);

  const handleSaveSettings = async () => {
    if (!calibration) return;
    setIsSaving(true);
    try {
      await profileApi.updateCalibration({
        ...calibration,
        preferences: {
          ...calibration.preferences,
          trackingSensitivity: sensitivity,
          mouthDragThreshold: dwellTime,
        },
      });
      alert('Profile settings saved successfully!');
    } catch (error) {
      console.error('Error saving profile settings:', error);
      alert('Failed to save profile settings. Please try again later.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  // Xử lý khi đang tải
  if (isLoading) {
    return (
      <div
        className="profile-page"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}
      >
        <Loader2 size={40} className="animate-spin text-orange-500 mr-3" />
        <p style={{ color: '#666', fontSize: '1.2rem', fontWeight: 500 }}>Profile is loading...</p>
      </div>
    );
  }

  // Xử lý khi server lỗi thật sự (không lấy được Profile)
  if (fetchError || !profileData) {
    return (
      <div
        className="profile-page"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
        }}
      >
        <AlertTriangle size={64} className="text-orange-500 mb-4" />
        <h2 style={{ color: '#fff', marginBottom: '1rem' }}>Lỗi tải dữ liệu</h2>
        <p style={{ color: '#aaa', marginBottom: '2rem' }}>Không thể kết nối đến máy chủ. Vui lòng thử lại sau.</p>
        <Link to="/lessons" className="btn btn-primary">
          Quay lại trang chủ
        </Link>
      </div>
    );
  }

  const memberSinceStr = profileData.createdAt
    ? new Date(profileData.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '...';

  return (
    <PageScale scale={0.8} className="profile-page">
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
              <img
                src={profileData.avatar || '/images/profilePicture.jpeg'}
                alt={t('settings.avatarAlt')}
                className="profile-avatar-img"
              />
            </div>
            <div className="profile-details">
              <h2>{profileData.name?.toUpperCase() || 'STUDENT'}</h2>
              <p>
                {t('settings.memberSincePrefix')} {memberSinceStr} • {t('settings.levelPrefix')}{' '}
                {profileData.level || 1} {t('settings.explorer')}
              </p>
            </div>
          </div>

          <div className="profile-stats-grid">
            <article className="profile-stat-card" tabIndex={0}>
              <CheckCircle size={52} strokeWidth={3} className="icon-green" />
              <strong>{profileData.lessonsCompleted || 0}</strong>
              <span>{t('settings.exercises')}</span>
            </article>
            <article className="profile-stat-card" tabIndex={0}>
              <Award size={52} strokeWidth={3} className="icon-orange" />
              <strong>{/* Giả sử bạn có trường badges */ 0}</strong>
              <span>{t('settings.badges')}</span>
            </article>
            <article className="profile-stat-card wide" tabIndex={0}>
              <Target size={52} strokeWidth={3} className="icon-light-green" />
              <strong>
                {profileData.streak || 0} {t('settings.streakDays')}
              </strong>
              <span>{t('settings.streak')}</span>
            </article>
          </div>
        </aside>

        <main className="profile-controls">
          <div className="profile-controls-inner">
            <section className="profile-language-section" style={{ marginBottom: '2.5rem' }}>
              <div
                className="profile-language-header"
                style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}
              >
                <div className="profile-heading-icon-wrap profile-heading-icon-wrap--language">
                  <Languages size={28} strokeWidth={2.5} color="#FFF9DC" />
                </div>
                <h3>{t('settings.languageTitle')}</h3>
              </div>
              <p style={{ marginBottom: '1rem', color: '#666' }}>{t('settings.languageSubtitle')}</p>
              <LanguageToggle />
            </section>
          </div>

          <div className="profile-controls-inner">
            <div
              className="profile-controls-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="profile-heading-icon-wrap">
                  <Eye size={28} strokeWidth={2.5} color="#FFF9DC" />
                </div>
                <h3>{t('settings.eyeTrackingTitle')}</h3>
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.9rem' }}
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                {t('settings.saveSettings')}
              </button>
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
    </PageScale>
  );
}
