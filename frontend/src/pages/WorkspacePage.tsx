import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Play, Lightbulb, ChevronRight, GripVertical, Settings, RefreshCw } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { getLessonById, getTopicById, oid } from "../lib/curriculum";

export default function WorkspacePage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { t, localizeLesson, localizeTopic } = useI18n();
  const lesson = lessonId ? getLessonById(lessonId) : undefined;

  if (!lessonId || !lesson) {
    return <Navigate to="/lessons" replace />;
  }

  const topic = getTopicById(oid(lesson.topic_id));
  const topicPath = topic ? `/lessons/${oid(topic._id)}` : "/lessons";
  const localizedLesson = localizeLesson(lesson);
  const localizedTopic = topic ? localizeTopic(topic) : null;

  return (
    <div className="workspace-page">
      <header className="workspace-topbar">
        <div className="workspace-left">
          <Link to={topicPath} className="workspace-icon-btn" aria-label={t("nav.backToLessons")}>
            <ArrowLeft size={28} strokeWidth={3} />
          </Link>
          <nav className="workspace-breadcrumbs">
            <Link to="/lessons">{t("nav.topics")}</Link>
            <ChevronRight size={24} strokeWidth={4} className="crumb-icon" />
            {localizedTopic ? (
              <Link to={topicPath}>{localizedTopic.title}</Link>
            ) : (
              <span>{t("nav.topic")}</span>
            )}
            <ChevronRight size={24} strokeWidth={4} className="crumb-icon" />
            <strong>{localizedLesson.title}</strong>
          </nav>
        </div>
        <div className="workspace-right">
          <button className="workspace-icon-btn" type="button" aria-label={t("workspace.reset")}>
            <RefreshCw size={28} strokeWidth={3} />
          </button>
          <Link to="/settings" className="workspace-icon-btn" aria-label={t("workspace.settings")}>
            <Settings size={28} strokeWidth={3} />
          </Link>
        </div>
      </header>

      <div className="workspace-main">
        <aside className="workspace-panel">
          <div className="objective-chip">{t("workspace.objective")}</div>
          <h1>{localizedLesson.title}</h1>
          <p>{localizedLesson.description}</p>

          <div className="workspace-panel-actions">
            <button type="button" className="workspace-panel-btn hint group">
              <Lightbulb size={36} strokeWidth={3} className="btn-icon text-orange" />
              {t("workspace.needHint")}
            </button>
            <button type="button" className="workspace-panel-btn run group">
              <Play size={44} strokeWidth={3} className="btn-icon fill-current" />
              {t("workspace.runCode")}
            </button>
          </div>
        </aside>

        <main className="workspace-canvas">
          <section className="blocks-zone">
            <div className="block start">
              <div className="drag-handle">
                <GripVertical size={32} />
              </div>
              <span>{t("workspace.onStart")}</span>
            </div>
            <div className="drop-ghost">{t("workspace.dropNext")}</div>
          </section>

          <aside className="workspace-library">
            <h3>{t("workspace.blockLibrary")}</h3>
            <p className="workspace-library-note">{t("workspace.blocklySoon")}</p>
          </aside>
        </main>
      </div>
    </div>
  );
}
