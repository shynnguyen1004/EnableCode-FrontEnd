import { Link } from "react-router-dom";
import { PlayCircle, CheckCircle, Lock } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";

export type CourseCardItem = {
  id: string;
  title: string;
  description: string;
  progress: number;
  difficulty: string;
  locked: boolean;
  tone: "green" | "light-green" | "dark";
  href: string;
};

type CourseCardGridProps = {
  items: CourseCardItem[];
};

export default function CourseCardGrid({ items }: CourseCardGridProps) {
  const { t } = useI18n();

  return (
    <section className="lesson-grid">
      {items.map((item) => (
        <Link
          key={item.id}
          to={item.locked ? "#" : item.href}
          className={`lesson-card tone-${item.tone}${item.locked ? " is-locked" : ""}`}
          aria-disabled={item.locked}
        >
          {item.locked ? (
            <div className="lock-overlay">
              <div className="lock-icon-wrap">
                <Lock size={40} className="text-white" strokeWidth={2.5} />
              </div>
              <span>{t("course.locked")}</span>
            </div>
          ) : null}

          <LessonCardBody item={item} progressLabel={t("course.progress")} />
        </Link>
      ))}
    </section>
  );
}

function LessonCardBody({ item, progressLabel }: { item: CourseCardItem; progressLabel: string }) {
  return (
    <>
      <div className="lesson-top">
        <span className="lesson-tag">{item.difficulty}</span>
        <div className="lesson-state-icon">
          {item.progress === 100 ? (
            <CheckCircle size={48} color="#3B5A28" strokeWidth={3} className="state-icon done" />
          ) : (
            <PlayCircle size={48} color="#FF7700" strokeWidth={3} className="state-icon start" />
          )}
        </div>
      </div>

      <h2>{item.title}</h2>
      <p>{item.description}</p>

      <div className="lesson-progress-wrap">
        <div className="lesson-progress-row">
              <span>{progressLabel}</span>
          <strong>{item.progress}%</strong>
        </div>
        <div className="lesson-progress-track">
          <div className="lesson-progress-fill" style={{ width: `${item.progress}%` }} />
        </div>
      </div>
    </>
  );
}
