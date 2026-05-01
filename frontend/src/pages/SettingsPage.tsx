import { useState } from "react";
import { Link } from "react-router-dom";

export default function SettingsPage() {
  const [sensitivity, setSensitivity] = useState(75);
  const [dwellTime, setDwellTime] = useState(40);
  const [visualFeedback, setVisualFeedback] = useState(true);

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
            <div className="avatar-placeholder">AC</div>
            <div>
              <h2>ALEX CODER</h2>
              <p>Member since May 2026 • Level 4 Explorer</p>
            </div>
          </div>

          <div className="stats-grid">
            <article>
              <strong>42</strong>
              <span>Exercises</span>
            </article>
            <article>
              <strong>7</strong>
              <span>Badges</span>
            </article>
            <article className="wide">
              <strong>15 Days</strong>
              <span>Current Learning Streak</span>
            </article>
          </div>
        </aside>

        <main className="settings-controls">
          <h3>Eye-Tracking Settings</h3>

          <section className="control-card">
            <h4>System Calibration</h4>
            <p>Recalibrate the tracker if the cursor is not matching your gaze.</p>
            <button className="settings-action-btn" type="button">
              Start Calibration
            </button>
          </section>

          <section className="control-card">
            <div className="control-row">
              <h4>Eye Sensitivity</h4>
              <strong>{sensitivity}%</strong>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={sensitivity}
              onChange={(event) => setSensitivity(Number(event.target.value))}
            />
          </section>

          <section className="control-card">
            <div className="control-row">
              <h4>Dwell Time (Click)</h4>
              <strong>{(dwellTime / 10).toFixed(1)}s</strong>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={dwellTime}
              onChange={(event) => setDwellTime(Number(event.target.value))}
            />
          </section>

          <button
            type="button"
            className="toggle-card"
            onClick={() => setVisualFeedback((value) => !value)}
          >
            <div>
              <h4>Visual Click Feedback</h4>
              <p>Show ring animation while dwelling over a target.</p>
            </div>
            <span className={`toggle-pill ${visualFeedback ? "on" : "off"}`}>
              {visualFeedback ? "ON" : "OFF"}
            </span>
          </button>
        </main>
      </div>
    </div>
  );
}
