import { useState } from 'react';
import { Link } from 'react-router-dom';

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

const SlidersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <line x1="3" y1="5" x2="17" y2="5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    <line x1="3" y1="10" x2="17" y2="10" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    <line x1="3" y1="15" x2="17" y2="15" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    <circle cx="7" cy="5" r="2" fill="#ff7700" stroke="#fff" strokeWidth="1.5" />
    <circle cx="13" cy="10" r="2" fill="#ff7700" stroke="#fff" strokeWidth="1.5" />
    <circle cx="9" cy="15" r="2" fill="#ff7700" stroke="#fff" strokeWidth="1.5" />
  </svg>
);

const CursorClickIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path
      d="M5 3L5 14L8.5 10.5L12 16L14 15L10.5 9L15 8Z"
      fill="#fff"
      stroke="#fff"
      strokeWidth="1"
      strokeLinejoin="round"
    />
  </svg>
);

const ToggleCheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M4 8L7 11L12 5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function ProfilePage() {
  const [sensitivity, setSensitivity] = useState(75);
  const [dwellTime, setDwellTime] = useState(40);
  const [visualFeedback, setVisualFeedback] = useState(true);

  // Khởi tạo state bằng cách đọc trực tiếp từ localStorage (nơi ta đã lưu lúc Login)
  const [currentUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);

        // Đổi chuỗi thời gian của Backend thành định dạng dễ đọc (VD: May 2026)
        const date = new Date(parsedUser.createdAt || new Date());
        const formattedDate = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

        return {
          name: parsedUser.name || 'Guest',
          level: parsedUser.level || 1,
          streak: parsedUser.streak || 0,
          lessonsCompleted: parsedUser.lessonsCompleted || 0,
          badges: 7, // Bạn có thể map số này sau nếu Backend hỗ trợ
          memberSince: formattedDate,
        };
      } catch (error) {
        console.error('Lỗi khi đọc thông tin User:', error);
      }
    }

    // Fallback mặc định nếu chưa đăng nhập hoặc lỗi
    return {
      name: 'Guest User',
      level: 1,
      streak: 0,
      lessonsCompleted: 0,
      badges: 0,
      memberSince: '...',
    };
  });

  // Helper để lấy 2 chữ cái đầu làm Avatar (VD: Hung Khoi -> HK)
  const getInitials = (name: string) => {
    const nameParts = name.split(' ');
    if (nameParts.length >= 2) {
      return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="settings-page">
      <header className="settings-topbar">
        <Link to="/lessons" className="workspace-icon-btn" aria-label="Back to lessons">
          ←
        </Link>
        <h1>Profile & Settings</h1>
        <div style={{ width: 48 }} />
      </header>

      <div className="settings-main">
        <aside className="settings-profile">
          <div className="profile-head">
            <div className="avatar-placeholder">{getInitials(currentUser.name)}</div>
            <div>
              <h2>{currentUser.name.toUpperCase()}</h2>
              <p>
                Member since {currentUser.memberSince} • Level {currentUser.level} Explorer
              </p>
            </div>
          </div>

          <div className="stats-grid">
            <article>
              <div className="stat-icon">
                <CheckCircleIcon />
              </div>
              <strong>{currentUser.lessonsCompleted}</strong>
              <span>EXERCISES</span>
            </article>
            <article>
              <div className="stat-icon">
                <BadgeIcon />
              </div>
              <strong>{currentUser.badges}</strong>
              <span>BADGES</span>
            </article>
            <article className="wide">
              <div className="stat-icon">
                <StreakIcon />
              </div>
              <strong>{currentUser.streak} Days</strong>
              <span>CURRENT LEARNING STREAK</span>
            </article>
          </div>
        </aside>

        <main className="settings-controls">
          <h3>
            <span className="settings-heading-icon">
              <EyeSettingsIcon />
            </span>
            Eye-Tracking Settings
          </h3>

          <section className="control-card">
            <h4>SYSTEM CALIBRATION</h4>
            <p>Recalibrate the tracker if the cursor isn't matching your gaze.</p>
            <button className="settings-action-btn" type="button">
              <CalibrateIcon />
              Start Calibration
            </button>
          </section>

          <section className="control-card">
            <div className="control-row">
              <h4>EYE SENSITIVITY</h4>
              <span className="control-value-badge">{sensitivity}%</span>
            </div>
            <p className="control-desc">Higher sensitivity makes the cursor move faster across the screen.</p>
            <div className="custom-range-wrap">
              <input
                type="range"
                min={1}
                max={100}
                value={sensitivity}
                onChange={event => setSensitivity(Number(event.target.value))}
                style={{ '--range-progress': `${sensitivity}%` } as React.CSSProperties}
              />
              <div className="range-thumb-icon" style={{ left: `calc(${sensitivity}% - 18px)` }}>
                <SlidersIcon />
              </div>
            </div>
          </section>

          <section className="control-card">
            <div className="control-row">
              <h4>DWELL TIME (CLICK)</h4>
              <span className="control-value-badge">{(dwellTime / 10).toFixed(1)}s</span>
            </div>
            <p className="control-desc">How long you need to stare at a button to trigger a "click".</p>
            <div className="custom-range-wrap">
              <input
                type="range"
                min={1}
                max={100}
                value={dwellTime}
                onChange={event => setDwellTime(Number(event.target.value))}
                style={{ '--range-progress': `${dwellTime}%` } as React.CSSProperties}
              />
              <div className="range-thumb-icon" style={{ left: `calc(${dwellTime}% - 18px)` }}>
                <CursorClickIcon />
              </div>
            </div>
          </section>

          <button type="button" className="toggle-card" onClick={() => setVisualFeedback(value => !value)}>
            <div>
              <h4>VISUAL CLICK FEEDBACK</h4>
              <p>Show an expanding ring animation while dwelling on buttons.</p>
            </div>
            <div className={`toggle-switch ${visualFeedback ? 'on' : 'off'}`}>
              <div className="toggle-knob">{visualFeedback && <ToggleCheckIcon />}</div>
            </div>
          </button>
        </main>
      </div>
    </div>
  );
}
