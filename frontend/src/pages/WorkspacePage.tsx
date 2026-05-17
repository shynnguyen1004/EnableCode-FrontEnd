import { Link } from "react-router-dom";
import { ArrowLeft, Play, Lightbulb, ChevronRight, GripVertical, Settings, RefreshCw } from "lucide-react";

export default function WorkspacePage() {
  return (
    <div className="workspace-page">
      <header className="workspace-topbar">
        <div className="workspace-left">
          <Link to="/lessons" className="workspace-icon-btn" aria-label="Back to lessons">
            <ArrowLeft size={28} strokeWidth={3} />
          </Link>
          <nav className="workspace-breadcrumbs">
            <Link to="/lessons">Lessons</Link>
            <ChevronRight size={24} strokeWidth={4} className="crumb-icon" />
            <span>Loops</span>
            <ChevronRight size={24} strokeWidth={4} className="crumb-icon" />
            <strong>Level 1: Introduction to Loops</strong>
          </nav>
        </div>
        <div className="workspace-right">
          <button className="workspace-icon-btn" type="button" aria-label="Reset">
            <RefreshCw size={28} strokeWidth={3} />
          </button>
          <Link to="/settings" className="workspace-icon-btn" aria-label="Settings">
            <Settings size={28} strokeWidth={3} />
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
            <button type="button" className="workspace-panel-btn hint group">
              <Lightbulb size={36} strokeWidth={3} className="btn-icon text-orange" />
              Need a Hint?
            </button>
            <button type="button" className="workspace-panel-btn run group">
              <Play size={44} strokeWidth={3} className="btn-icon fill-current" />
              Run Code
            </button>
          </div>
        </aside>

        <main className="workspace-canvas">
          <section className="blocks-zone">
            <div className="block start">
              <div className="drag-handle"><GripVertical size={32} /></div>
              <span>On Start</span>
            </div>
            <div className="block repeat">
              <div className="block-row">
                <div className="drag-handle"><GripVertical size={32} /></div>
                <span>Repeat</span>
                <span className="pill">3</span>
                <span>times</span>
              </div>
              <div className="nested-drop">
                <div className="block move">
                  <div className="drag-handle"><GripVertical size={28} /></div>
                  <span>Move Forward</span>
                  <span className="pill">1 step</span>
                </div>
              </div>
            </div>
            <div className="drop-ghost">Drop Next Block Here</div>
          </section>

          <aside className="workspace-library">
            <h3>Block Library</h3>
            <div className="library-item green">
              <div className="drag-handle small"><GripVertical size={24} /></div>
              <span>Move Forward</span>
            </div>
            <div className="library-item orange">
              <div className="drag-handle small"><GripVertical size={24} /></div>
              <span>Repeat (...)</span>
            </div>
            <div className="library-item blue">
              <div className="drag-handle small"><GripVertical size={24} /></div>
              <span>If (...) Then</span>
            </div>
            <div className="library-item purple">
              <div className="drag-handle small"><GripVertical size={24} /></div>
              <span>Calculate</span>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
