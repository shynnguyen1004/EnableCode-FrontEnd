// 1. TẤT CẢ IMPORT PHẢI NẰM Ở ĐÂY
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  Target,
  Award,
  Languages,
  Loader2,
  AlertTriangle,
  ScanFace,
  LogOut,
  Pencil,
  X,
} from 'lucide-react';
import LanguageToggle from '../components/LanguageToggle';
import PageScale from '../components/PageScale';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../context/AuthContext';
import { profileApi } from '../api/profileApi';
import { authApi } from '../api/authApi';
import { AvatarImageError, processAvatarFile } from '../lib/avatarImage';
import type { UserProfileResponse } from '../lib/types';

function formatDisplayName(name?: string): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return 'STUDENT';
  if (parts.length === 1) return parts[0].toUpperCase();

  const lastName = parts[parts.length - 1].toUpperCase();
  const initials = parts.slice(0, -1).map(part => `${part.charAt(0).toUpperCase()}.`);
  return [...initials, lastName].join(' ');
}

export default function ProfilePage() {
  const { t, locale } = useI18n();
  const { isLoggedIn, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  // State quản lý dữ liệu
  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [avatarFileName, setAvatarFileName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [editError, setEditError] = useState('');

  // -> THÊM STATE QUẢN LÝ TỐC ĐỘ CHUỘT
  const [mouseSpeed, setMouseSpeed] = useState<'low' | 'medium' | 'high'>('medium');

  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoggedIn) return;

    const fetchProfileData = async () => {
      setIsLoading(true);
      setFetchError(false);
      try {
        const profileRes = await profileApi.getProfile();
        setProfileData(profileRes);
        // Gợi ý: Nếu API profile có trả về trackingSensitivity, bạn có thể setMouseSpeed ở đây
      } catch (error) {
        console.error('Error fetching profile:', error);
        setFetchError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileData();
  }, [isLoggedIn]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Failed to logout from server:', error);
    } finally {
      setIsLoggingOut(false);
      logout();
    }
  };

  const openEditModal = () => {
    if (!profileData) return;
    setEditName(profileData.name || '');
    setEditAvatar(profileData.avatar || '');
    setAvatarFileName(profileData.avatar ? t('settings.editProfileCurrentAvatar') : '');
    setEditError('');
    if (avatarInputRef.current) avatarInputRef.current.value = '';
    setIsEditOpen(true);
  };

  const closeEditModal = () => {
    if (isSavingProfile) return;
    setIsEditOpen(false);
    setEditError('');
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const getAvatarErrorMessage = (error: AvatarImageError) => {
    if (error.code === 'invalid_type') return t('settings.editProfileAvatarInvalid');
    if (error.code === 'too_large') return t('settings.editProfileAvatarTooLarge');
    return t('settings.editProfileAvatarProcessFailed');
  };

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await processAvatarFile(file);
      setEditAvatar(dataUrl);
      setAvatarFileName(file.name);
      setEditError('');
    } catch (error) {
      if (error instanceof AvatarImageError) {
        setEditError(getAvatarErrorMessage(error));
      } else {
        setEditError(t('settings.editProfileAvatarProcessFailed'));
      }
    }
  };

  const handleRemoveAvatar = () => {
    setEditAvatar('');
    setAvatarFileName('');
    setEditError('');
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profileData) return;

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditError(t('settings.editProfileNameRequired'));
      return;
    }

    setIsSavingProfile(true);
    setEditError('');

    try {
      const updatedProfile = await profileApi.updateProfile({
        name: trimmedName,
        avatar: editAvatar.trim() || null,
      });
      setProfileData(updatedProfile);
      updateUser(updatedProfile);
      setIsEditOpen(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
      setEditError(t('settings.editProfileFailed'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  // -> THÊM HÀM XỬ LÝ ĐỔI TỐC ĐỘ CHUỘT
  const handleSpeedChange = async (speed: 'low' | 'medium' | 'high') => {
    setMouseSpeed(speed);

    // Gợi ý: Bạn có thể gọi API updateCalibration hoặc update Context ở đây để lưu thiết lập
    // const sensitivityMap = { low: 0.5, medium: 1.0, high: 2.0 };
    // await profileApi.updateCalibration({ preferences: { trackingSensitivity: sensitivityMap[speed] } });
  };

  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return (
      <div
        className="profile-page"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}
      >
        <Loader2 size={40} className="animate-spin text-orange-500 mr-3" />
        <p style={{ color: '#666', fontSize: '1.2rem', fontWeight: 500 }}>
          {t('settings.loadingProfile') || 'Profile is loading...'}
        </p>
      </div>
    );
  }

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
        <h2 style={{ color: '#fff', marginBottom: '1rem' }}>{t('settings.errorTitle')}</h2>
        <p style={{ color: '#aaa', marginBottom: '2rem' }}>{t('settings.errorDesc')}</p>
        <Link to="/" className="btn btn-primary">
          {t('settings.backToHome')}
        </Link>
      </div>
    );
  }

  let memberSinceStr = '...';
  if (profileData?.createdAt) {
    const date = new Date(profileData.createdAt);
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    if (locale.includes('vi')) {
      memberSinceStr = `tháng ${month} năm ${year}`;
    } else {
      memberSinceStr = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
  }

  return (
    <PageScale scale={0.8} className="profile-page">
      <header className="profile-topbar">
        <button onClick={() => navigate(-1)} className="profile-back-btn" aria-label="Go back">
          <ArrowLeft size={32} strokeWidth={3} />
        </button>
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
              <h2>{formatDisplayName(profileData.name)}</h2>
              <p>
                {t('settings.memberSincePrefix')} {memberSinceStr}
              </p>
              <p>
                {t('settings.levelPrefix')} {profileData.level || 1} {t('settings.explorer')}
              </p>
              <button type="button" className="profile-edit-btn" onClick={openEditModal}>
                <Pencil size={20} strokeWidth={3} />
                {t('settings.editProfile')}
              </button>
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
              <strong>0</strong>
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
              <div className="profile-subsection-header">
                <div className="profile-heading-icon-wrap profile-heading-icon-wrap--language">
                  <Languages size={28} strokeWidth={2.5} color="#FFF9DC" />
                </div>
                <h4 className="profile-subsection-title" style={{ margin: 0 }}>
                  {t('settings.languageTitle')}
                </h4>
              </div>
              <p className="profile-section-desc">{t('settings.languageSubtitle')}</p>
              <LanguageToggle />
            </section>
          </div>

          <div className="profile-controls-inner">
            <div className="profile-subsection-header">
              <div className="profile-heading-icon-wrap">
                <ScanFace size={28} strokeWidth={2.5} color="#FFF9DC" />
              </div>
              <h4 className="profile-subsection-title" style={{ margin: 0 }}>
                {t('settings.eyeTrackingTitle') || 'FACE CONTROL SENSITIVITY'}
              </h4>
            </div>
            <p className="profile-section-desc">
              {t('settings.mouseSpeedDesc') || 'Adjust how fast the cursor moves when you turn your head.'}
            </p>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {[
                { id: 'low', label: t('settings.speedLow') || 'Low' },
                { id: 'medium', label: t('settings.speedMedium') || 'Medium' },
                { id: 'high', label: t('settings.speedHigh') || 'High' },
              ].map(item => {
                const isActive = mouseSpeed === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSpeedChange(item.id as 'low' | 'medium' | 'high')}
                    className={`language-toggle-btn ${isActive ? 'is-active' : ''}`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <section className="profile-calibration-section profile-calibration-section--spaced">
              <div className="profile-subsection-header">
                <div className="profile-heading-icon-wrap">
                  <Target size={28} strokeWidth={2.5} color="#FFF9DC" />
                </div>
                <h4 className="profile-subsection-title" style={{ margin: 0 }}>
                  {t('settings.calibrationTitle') || 'SYSTEM CALIBRATION'}
                </h4>
              </div>
              <p className="profile-section-desc">
                {t('settings.calibrationBody') ||
                  "Recalibrate if the cursor isn't following your head movement accurately."}
              </p>
              <div className="profile-action-stack">
                <Link to="/calibration" className="profile-action-btn group">
                  <Target size={44} strokeWidth={3} color="#FFF9DC" className="profile-action-icon" />
                  {t('settings.startCalibration') || 'Start Calibration'}
                </Link>
                <Link to="/face-register" className="profile-action-btn profile-action-btn--face-login group">
                  <ScanFace size={44} strokeWidth={3} color="#FFF9DC" className="profile-action-icon" />
                  {t('settings.setupFaceLogin') || 'Setup Face Login'}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="profile-action-btn profile-action-btn--logout group"
                >
                  {isLoggingOut ? (
                    <Loader2 size={44} strokeWidth={3} color="#FFF9DC" className="profile-action-icon animate-spin" />
                  ) : (
                    <LogOut size={44} strokeWidth={3} color="#FFF9DC" className="profile-action-icon" />
                  )}
                  {t('settings.logoutAccount') || 'Log Out Account'}
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>

      {isEditOpen && (
        <div className="profile-edit-overlay" onClick={closeEditModal} role="presentation">
          <div
            className="profile-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-edit-title"
            onClick={event => event.stopPropagation()}
          >
            <button
              type="button"
              className="profile-edit-close"
              onClick={closeEditModal}
              aria-label={t('settings.editProfileCancel')}
            >
              <X size={28} strokeWidth={3} />
            </button>

            <h3 id="profile-edit-title">{t('settings.editProfileTitle')}</h3>

            <div className="profile-edit-preview">
              <img
                src={editAvatar.trim() || profileData.avatar || '/images/profilePicture.jpeg'}
                alt={t('settings.avatarAlt')}
                className="profile-edit-preview-img"
              />
            </div>

            <form className="profile-edit-form" onSubmit={handleSaveProfile}>
              <label htmlFor="profile-edit-name">{t('settings.editProfileName')}</label>
              <input
                id="profile-edit-name"
                type="text"
                value={editName}
                onChange={event => setEditName(event.target.value)}
                placeholder={t('settings.editProfileNamePlaceholder')}
                disabled={isSavingProfile}
                required
              />

              <label htmlFor="profile-edit-avatar">{t('settings.editProfileAvatar')}</label>
              <p className="profile-edit-hint">{t('settings.editProfileAvatarHint')}</p>
              <div className="profile-edit-upload-row">
                <input
                  ref={avatarInputRef}
                  id="profile-edit-avatar"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="profile-edit-file-input"
                  onChange={handleAvatarFileChange}
                  disabled={isSavingProfile}
                />
                <button
                  type="button"
                  className="profile-edit-upload-btn"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={isSavingProfile}
                >
                  {t('settings.editProfileChooseFile')}
                </button>
                {editAvatar && (
                  <button
                    type="button"
                    className="profile-edit-remove-btn"
                    onClick={handleRemoveAvatar}
                    disabled={isSavingProfile}
                  >
                    {t('settings.editProfileRemoveAvatar')}
                  </button>
                )}
              </div>
              {avatarFileName && <p className="profile-edit-file-name">{avatarFileName}</p>}

              {editError && <p className="profile-edit-error">{editError}</p>}

              <div className="profile-edit-actions">
                <button
                  type="button"
                  className="profile-edit-cancel"
                  onClick={closeEditModal}
                  disabled={isSavingProfile}
                >
                  {t('settings.editProfileCancel')}
                </button>
                <button type="submit" className="profile-edit-save" disabled={isSavingProfile}>
                  {isSavingProfile ? (
                    <>
                      <Loader2 size={22} className="animate-spin" />
                      {t('settings.editProfileSaving')}
                    </>
                  ) : (
                    t('settings.editProfileSave')
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageScale>
  );
}
