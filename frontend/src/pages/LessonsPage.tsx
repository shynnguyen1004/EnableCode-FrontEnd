import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import CourseCardGrid, { type CourseCardItem } from "../components/CourseCardGrid";
import CourseSidebar from "../components/CourseSidebar";
import { useI18n } from "../i18n/I18nProvider";
import {
  getTopicById,
  getLessonsByTopicId,
  oid,
  cardTone,
  isLessonLocked,
  isTopicLocked,
  isLessonCompleted,
} from "../lib/curriculum";

export default function LessonsPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const { t, localizeTopic, localizeLesson, difficultyLabel } = useI18n();
  const topic = topicId ? getTopicById(topicId) : undefined;

  if (!topicId || !topic) {
    return <Navigate to="/lessons" replace />;
  }

  if (isTopicLocked(topic)) {
    return <Navigate to="/lessons" replace />;
  }

  const lessonsInTopic = getLessonsByTopicId(topicId);
  const localizedTopic = localizeTopic(topic);

  const items: CourseCardItem[] = lessonsInTopic.map((lesson, index) => {
    const localized = localizeLesson(lesson);
    return {
      id: oid(lesson._id),
      title: `${lesson.order}. ${localized.title}`,
      description: localized.description,
      progress: isLessonCompleted(oid(lesson._id)) ? 100 : 0,
      difficulty: difficultyLabel(lesson.difficulty),
      locked: isLessonLocked(lesson, lessonsInTopic),
      tone: cardTone(index),
      href: `/workspace/${oid(lesson._id)}`,
    };
  });

  return (
    <div className="lessons-page">
      <CourseSidebar active="lessons" />

      <main className="lessons-content">
        <header className="lessons-header">
          <Link to="/lessons" className="lessons-back-link">
            <ArrowLeft size={24} strokeWidth={3} />
            {t("nav.allTopics")}
          </Link>
          <h1>{localizedTopic.title}</h1>
          <p>{localizedTopic.description}</p>
        </header>

        <CourseCardGrid items={items} />
      </main>
    </div>
  );
}
