import CourseCardGrid, { type CourseCardItem } from "../components/CourseCardGrid";
import CourseSidebar from "../components/CourseSidebar";
import { useI18n } from "../i18n/I18nProvider";
import { topics, oid, cardTone, isTopicLocked, getTopicProgressPercent } from "../lib/curriculum";

export default function TopicPage() {
  const { t, localizeTopic, difficultyLabel } = useI18n();

  const items: CourseCardItem[] = topics.map((topic, index) => {
    const localized = localizeTopic(topic);
    return {
      id: oid(topic._id),
      title: `${index + 1}. ${localized.title}`,
      description: localized.description,
      progress: getTopicProgressPercent(oid(topic._id)),
      difficulty: difficultyLabel(topic.difficulty),
      locked: isTopicLocked(topic),
      tone: cardTone(index),
      href: `/lessons/${oid(topic._id)}`,
    };
  });

  return (
    <div className="lessons-page">
      <CourseSidebar active="lessons" />

      <main className="lessons-content">
        <header className="lessons-header">
          <h1>{t("topics.dashboardTitle")}</h1>
          <p>{t("topics.dashboardSubtitle")}</p>
        </header>

        <CourseCardGrid items={items} />
      </main>
    </div>
  );
}
