import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import CourseCardGrid, { type CourseCardItem } from '../components/CourseCardGrid';
import CourseSidebar from '../components/CourseSidebar';
import { useI18n } from '../i18n/I18nProvider';

import { oid, cardTone } from '../lib/curriculum';
import { isTopicLocked, isLessonLocked, isLessonCompleted } from '../lib/progress';
import { lessonApi } from '../api/lessonApi';

// 1. Import các hàm từ Mapper
import { extractTopics, extractLessons } from '../utils/lessonMapper';
import { FrontendTopic, FrontendLesson } from '../types';

// Các type kế thừa để đảm bảo TypeScript không báo lỗi với các hàm lib cũ
type LegacyTopic = Parameters<ReturnType<typeof useI18n>['localizeTopic']>[0];
type LegacyProgressTopic = Parameters<typeof isTopicLocked>[0];

type LegacyLesson = Parameters<ReturnType<typeof useI18n>['localizeLesson']>[0];
type LegacyProgressLesson = Parameters<typeof isLessonLocked>[0];

type CompatibleTopic = FrontendTopic & LegacyTopic & LegacyProgressTopic;
type CompatibleLesson = FrontendLesson & LegacyLesson & LegacyProgressLesson;

export default function LessonsPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const { t, localizeTopic, localizeLesson, difficultyLabel } = useI18n();

  const [topic, setTopic] = useState<CompatibleTopic | null>(null);
  const [lessons, setLessons] = useState<CompatibleLesson[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);

  useEffect(() => {
    if (!topicId) return;

    const fetchData = async () => {
      try {
        const [topicsRes, lessonsRes] = await Promise.all([
          lessonApi.getTopics(),
          lessonApi.getLessonsByTopic(topicId),
        ]);

        // 2. Dùng Mapper siêu gọn, bóc tách và format dữ liệu chỉ trong 2 dòng
        const formattedTopics = extractTopics(topicsRes);
        const formattedLessons = extractLessons(lessonsRes, topicId);

        // 3. Tìm Topic hiện tại
        const currentTopic = formattedTopics.find(t => oid(t._id) === topicId);

        if (!currentTopic) {
          setIsNotFound(true);
        } else {
          // Ép kiểu sang Compatible để tương thích với các hàm legacy
          setTopic(currentTopic as unknown as CompatibleTopic);
          setLessons(formattedLessons as unknown as CompatibleLesson[]);
        }
      } catch (error) {
        console.error('Failed to fetch lesson data:', error);
        setIsNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [topicId]);

  if (!topicId || isNotFound) {
    return <Navigate to="/lessons" replace />;
  }

  if (topic && isTopicLocked(topic)) {
    // Ép kiểu tạm thời để bypass lỗi type mismatch (nếu có)
    return <Navigate to="/lessons" replace />;
  }

  if (isLoading || !topic) {
    return (
      <div className="lessons-page">
        <CourseSidebar active="lessons" />
        <main className="lessons-content">
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
            <p>Loading lessons...</p>
          </div>
        </main>
      </div>
    );
  }

  const localizedTopic = localizeTopic(topic) || topic;

  const items: CourseCardItem[] = lessons.map((lesson, index) => {
    const localized = localizeLesson(lesson) || lesson;

    return {
      id: lesson._id,
      title: `${lesson.order}. ${localized.title}`,
      description: localized.description,
      progress: isLessonCompleted(lesson._id) ? 100 : 0,
      difficulty: difficultyLabel(lesson.difficulty),
      locked: isLessonLocked(lesson, lessons),
      tone: cardTone(index),
      href: `/workspace/${lesson._id}`,
    };
  });

  return (
    <div className="lessons-page">
      <CourseSidebar active="lessons" />

      <main className="lessons-content">
        <header className="lessons-header">
          <Link to="/lessons" className="lessons-back-link">
            <ArrowLeft size={24} strokeWidth={3} />
            {t('nav.allTopics')}
          </Link>
          <h1>{localizedTopic.title}</h1>
          <p>{localizedTopic.description}</p>
        </header>

        <CourseCardGrid items={items} />
      </main>
    </div>
  );
}
