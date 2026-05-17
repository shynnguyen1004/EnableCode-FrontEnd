import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle,
  Target,
  Award,
  Eye,
  SlidersHorizontal,
  MousePointer2,
} from "lucide-react";

export default function ProfilePage() {
  const [sensitivity, setSensitivity] = useState(75);
  const [dwellTime, setDwellTime] = useState(40);

  return (
    <div className="profile-page">
      <header className="profile-topbar">
        <Link to="/lessons" className="profile-back-btn" aria-label="Back to lessons">
          <ArrowLeft size={24} strokeWidth={3} />
        </Link>
        <h1>Profile & Settings</h1>
        <div className="profile-topbar-spacer" />
      </header>

      <div className="profile-main">
        <aside className="profile-sidebar">
          <div className="profile-user-info">
            <div className="profile-avatar-wrap">
              <img
                src="/images/profilePicture.jpeg"
                alt="User Avatar"
                className="profile-avatar-img"
              />
            </div>
            <div className="profile-details">
              <h2>ALEX CODER</h2>
              <p>Member since May 2026 • Level 4 Explorer</p>
            </div>
          </div>

          <div className="profile-stats-grid">
            <article className="profile-stat-card">
              <div className="profile-stat-icon">
                <CheckCircle size={32} strokeWidth={3} className="icon-green" />
              </div>
              <strong>42</strong>
              <span>EXERCISES</span>
            </article>
            <article className="profile-stat-card">
              <div className="profile-stat-icon">
                <Award size={32} strokeWidth={3} className="icon-orange" />
              </div>
              <strong>7</strong>
              <span>BADGES</span>
            </article>
            <article className="profile-stat-card wide">
              <div className="profile-stat-icon">
                <Target size={32} strokeWidth={3} className="icon-light-green" />
              </div>
              <strong>15 Days</strong>
              <span>CURRENT LEARNING STREAK</span>
            </article>
          </div>
        </aside>

        <main className="profile-controls">
          {/* Heading */}
          <div className="profile-controls-header">
            <div className="profile-heading-icon-wrap">
              <Eye size={28} strokeWidth={2.5} color="#FFF9DC" />
            </div>
            <h2>Eye-Tracking Settings</h2>
          </div>

          {/* System Calibration — OUTSIDE the white card */}
          <section className="profile-calibration-section">
            <h4>SYSTEM CALIBRATION</h4>
            <p>Recalibrate the tracker if the cursor isn't matching your gaze.</p>
            <button className="profile-action-btn" type="button">
              <Target size={24} strokeWidth={3} color="#FFF9DC" />
              Start Calibration
            </button>
          </section>

          {/* Eye Sensitivity — inside white card */}
          <section className="profile-control-card">
            <div className="profile-control-row">
              <h4>EYE SENSITIVITY</h4>
              <span className="profile-badge-orange">{sensitivity}%</span>
            </div>
            <p>Higher sensitivity makes the cursor move faster across the screen.</p>
            <div className="profile-slider-wrap">
              <input
                type="range"
                min={1}
                max={100}
                value={sensitivity}
                onChange={(event) => setSensitivity(Number(event.target.value))}
                style={{ "--range-progress": `${sensitivity}%` } as React.CSSProperties}
              />
              <div
                className="profile-range-thumb-icon"
                style={{ left: `calc(${sensitivity}% - 22px)` }}
              >
                <SlidersHorizontal size={20} strokeWidth={3} color="#FFF9DC" />
              </div>
            </div>
          </section>

          {/* Dwell Time — inside white card */}
          <section className="profile-control-card">
            <div className="profile-control-row">
              <h4>DWELL TIME (CLICK)</h4>
              <span className="profile-badge-green">{(dwellTime / 10).toFixed(1)}s</span>
            </div>
            <p>How long you need to stare at a button to trigger a "click".</p>
            <div className="profile-slider-wrap">
              <input
                type="range"
                min={1}
                max={100}
                value={dwellTime}
                onChange={(event) => setDwellTime(Number(event.target.value))}
                style={{ "--range-progress": `${dwellTime}%` } as React.CSSProperties}
              />
              <div
                className="profile-range-thumb-icon"
                style={{ left: `calc(${dwellTime}% - 22px)` }}
              >
                <MousePointer2 size={20} strokeWidth={3} color="#FFF9DC" />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
