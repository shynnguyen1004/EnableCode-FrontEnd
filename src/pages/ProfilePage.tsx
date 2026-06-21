import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Target, Award, Eye, Languages, Loader2, AlertTriangle } from 'lucide-react';
import LanguageToggle from '../components/LanguageToggle';
import PageScale from '../components/PageScale';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthContext';
import { profileApi } from '../api/profileApi';
import type { UserProfileResponse } from '../lib/types';

export default function ProfilePage() {
  const { t } = useI18n();
  const { isLoggedIn } = useAuth();

  // Chỉ giữ lại state quản lý dữ liệu Profile và trạng thái tải trang
  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;

    const fetchProfileData = async () => {
      setIsLoading(true);
      setFetchError(false);
      try {
        // Chỉ gọi API lấy thông tin user
        const profileRes = await profileApi.getProfile();
        setProfileData(profileRes);
      } catch (error) {
        console.error('Error fetching profile:', error);
        setFetchError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  // Xử lý hiển thị loading
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

  // Xử lý khi server lỗi
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
          {/* Cài đặt Ngôn ngữ */}
          <div className="profile-controls-inner">
            <section className="profile-language-section" style={{ marginBottom: '2.5rem' }}>
              <div
                className="profile-language-header"
                style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}
              >
                <div className="profile-heading-icon-wrap profile-heading-icon-wrap--language">
                  <Languages size={28} strokeWidth={2.5} color="#FFF9DC" />
                </div>
                <h3 style={{ margin: 0 }}>{t('settings.languageTitle')}</h3>
              </div>
              <p style={{ marginBottom: '1rem', color: '#666' }}>{t('settings.languageSubtitle')}</p>
              <LanguageToggle />
            </section>
          </div>

          {/* Cài đặt Eye Tracking */}
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
                <h3 style={{ margin: 0 }}>{t('settings.eyeTrackingTitle')}</h3>
              </div>
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
            </div>
          </div>
        </main>
      </div>
    </PageScale>
  );
}
