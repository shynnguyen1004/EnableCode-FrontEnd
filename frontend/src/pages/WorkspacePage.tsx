import { Link } from "react-router-dom";

export default function WorkspacePage() {
  return (
    <div className="workspace-page">
      <header className="workspace-topbar">
        <div className="workspace-left">
          <Link to="/lessons" className="workspace-icon-btn" aria-label="Back to lessons">
            ←
          </Link>
          <nav className="workspace-breadcrumbs">
            <Link to="/lessons">Lessons</Link>
            <span>/</span>
            <span>Loops</span>
            <span>/</span>
            <strong>Level 1: Introduction to Loops</strong>
          </nav>
        </div>
        <div className="workspace-right">
          <button className="workspace-icon-btn" type="button" aria-label="Reset">
            ↺
          </button>
          <Link to="/settings" className="workspace-icon-btn" aria-label="Settings">
            ⚙
          </Link>
        </div>
      </header>

      <div className="workspace-main">
        <aside className="workspace-panel">
          <div className="objective-chip">Objective</div>
          <h1>Move to the Target</h1>
          <p>
            Your robot is stuck. Move it exactly <strong>3 steps</strong> forward to reach the green
            zone.
          </p>
          <p>
            Drag a movement block into the workspace, then wrap it in a repeat block to run it
            automatically.
          </p>

          <div className="workspace-panel-actions">
            <button type="button" className="workspace-panel-btn hint">
              Need a Hint?
            </button>
            <button type="button" className="workspace-panel-btn run">
              Run Code
            </button>
          </div>
        </aside>

        <main className="workspace-canvas">
          <section className="blocks-zone">
            <div className="block start">On Start</div>
            <div className="block repeat">
              <div className="block-row">
                <span>Repeat</span>
                <span className="pill">3</span>
                <span>times</span>
              </div>
              <div className="nested-drop">
                <div className="block move">
                  <span>Move Forward</span>
                  <span className="pill">1 step</span>
                </div>
              </div>
            </div>
            <div className="drop-ghost">Drop Next Block Here</div>
          </section>

          <aside className="workspace-library">
            <h3>Block Library</h3>
            <div className="library-item green">Move Forward</div>
            <div className="library-item orange">Repeat (...)</div>
            <div className="library-item blue">If (...) Then</div>
            <div className="library-item purple">Calculate</div>
          </aside>
        </main>
      </div>
    </div>
  );
}
