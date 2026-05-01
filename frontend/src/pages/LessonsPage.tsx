import { Link } from "react-router-dom";

type Lesson = {
  id: number;
  title: string;
  description: string;
  progress: number;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  locked: boolean;
  tone: "green" | "light-green" | "dark";
};

const lessons: Lesson[] = [
  {
    id: 1,
    title: "1. Logic Basics",
    description: "Learn how to make decisions in code using simple IF and THEN blocks.",
    progress: 100,
    difficulty: "Beginner",
    locked: false,
    tone: "green",
  },
  {
    id: 2,
    title: "2. Variables",
    description: "Create containers to store and update numbers, words, and states.",
    progress: 60,
    difficulty: "Beginner",
    locked: false,
    tone: "light-green",
  },
  {
    id: 3,
    title: "3. Loops",
    description: "Command the computer to repeat actions automatically.",
    progress: 0,
    difficulty: "Intermediate",
    locked: false,
    tone: "dark",
  },
  {
    id: 4,
    title: "4. Functions",
    description: "Group blocks into reusable actions for complex workflows.",
    progress: 0,
    difficulty: "Intermediate",
    locked: true,
    tone: "dark",
  },
  {
    id: 5,
    title: "5. Events",
    description: "Trigger logic when actions happen, like click or timer events.",
    progress: 0,
    difficulty: "Intermediate",
    locked: true,
    tone: "dark",
  },
  {
    id: 6,
    title: "6. Project",
    description: "Combine all modules to build your first interactive mini app.",
    progress: 0,
    difficulty: "Advanced",
    locked: true,
    tone: "dark",
  },
];

export default function LessonsPage() {
  return (
    <div className="lessons-page">
      <aside className="lessons-sidebar">
        <div className="lessons-sidebar-brand">
          <Link to="/" aria-label="Enable Code Home">
            <img src="/logo/TL_App_Logo.png" alt="Enable Code logo light mode" className="lessons-logo" />
          </Link>
        </div>

        <nav className="lessons-nav">
          <Link to="/" className="lessons-nav-link">
            Home
          </Link>
          <Link to="/lessons" className="lessons-nav-link is-active">
            Lessons
          </Link>
          <Link to="/settings" className="lessons-nav-link">
            Settings
          </Link>
        </nav>
      </aside>

      <main className="lessons-content">
        <header className="lessons-header">
          <h1>Course Dashboard</h1>
          <p>Select a module to continue learning.</p>
        </header>

        <section className="lesson-grid">
          {lessons.map((lesson) => {
            const targetPath = lesson.locked ? "#" : "/workspace";

            return (
              <Link
                key={lesson.id}
                to={targetPath}
                className={`lesson-card tone-${lesson.tone}${lesson.locked ? " is-locked" : ""}`}
                aria-disabled={lesson.locked}
              >
                {lesson.locked && <div className="lock-overlay">Locked</div>}

                <div className="lesson-top">
                  <span className="lesson-tag">{lesson.difficulty}</span>
                  <span className="lesson-state">{lesson.progress === 100 ? "Done" : "Start"}</span>
                </div>

                <h2>{lesson.title}</h2>
                <p>{lesson.description}</p>

                <div className="lesson-progress-wrap">
                  <div className="lesson-progress-row">
                    <span>Progress</span>
                    <strong>{lesson.progress}%</strong>
                  </div>
                  <div className="lesson-progress-track">
                    <div className="lesson-progress-fill" style={{ width: `${lesson.progress}%` }} />
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      </main>
    </div>
  );
}
