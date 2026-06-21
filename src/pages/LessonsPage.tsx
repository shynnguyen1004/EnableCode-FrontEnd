import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import CourseCardGrid, { type CourseCardItem } from '../components/CourseCardGrid';
import CourseSidebar from '../components/CourseSidebar';
import { useI18n } from '../i18n/I18nProvider';

// Import UserProgress
import type { Topic, Lesson, UserProgress } from '../lib/types';
import { cardTone } from '../lib/curriculum';
import { isTopicLocked, isLessonLocked, isLessonCompleted } from '../lib/progress';

// Remove unused lessonApi, add progressApi
import { topicApi } from '../api/topicApi';
import { progressApi } from '../api/progressApi';
import { extractTopics, extractLessons } from '../utils/lessonMapper';

export default function LessonsPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const { t, localizeTopic, localizeLesson, difficultyLabel } = useI18n();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [userProgressList, setUserProgressList] = useState<UserProgress[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);

  useEffect(() => {
    if (!topicId) return;

    const fetchCourseData = async () => {
      try {
        // Fetch topics, lessons, and progress in parallel
        const [topicsRes, lessonsRes, progressRes] = await Promise.all([
          topicApi.getAllTopics(),
          topicApi.getLessonsByTopic(topicId),
          progressApi.getAllUserProgress(),
        ]);

        const formattedTopics = extractTopics(topicsRes);
        const formattedLessons = extractLessons(lessonsRes);

        const currentTopic = formattedTopics.find(t => t._id === topicId);

        if (!currentTopic) {
          setIsNotFound(true);
          return; // Guard clause to exit early
        }

        setTopic(currentTopic);
        setUserProgressList(progressRes);

        // Sort lessons explicitly by order to guarantee UI consistency
        const activeSortedLessons = formattedLessons
          .filter(lesson => lesson.isActive)
          .sort((a, b) => a.order - b.order);

        setLessons(activeSortedLessons);
      } catch (error) {
        console.error('Failed to fetch lesson data:', error);
        setIsNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourseData();
  }, [topicId]);

  if (!topicId || isNotFound) {
    return <Navigate to="/lessons" replace />;
  }

  // Pass userProgressList to the topic lock check
  if (topic && isTopicLocked(topic)) {
    return <Navigate to="/lessons" replace />;
  }

  if (isLoading || !topic) {
    return (
      <div className="lessons-page">
        <CourseSidebar active="lessons" />
        <main className="lessons-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={40} className="animate-spin text-orange-500 mr-3" />
          <p style={{ color: '#666', fontSize: '1.2rem', fontWeight: 500 }}>Loading lessons...</p>
        </main>
      </div>
    );
  }

  const localizedTopic = localizeTopic(topic) || topic;

  const items: CourseCardItem[] = lessons.map((lesson, index) => {
    const localized = localizeLesson(lesson) || lesson;

    // Inject userProgressList into the utility functions
    const isCompleted = isLessonCompleted(lesson._id, userProgressList);
    const isLocked = isLessonLocked(lesson, lessons, userProgressList);

    return {
      id: lesson._id,
      title: `${lesson.order}. ${localized.title}`,
      description: localized.description || '',
      progress: isCompleted ? 100 : 0,
      difficulty: difficultyLabel(lesson.difficulty),
      locked: isLocked,
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
          <p>{localizedTopic.description || ''}</p>
        </header>

        <CourseCardGrid items={items} />
      </main>
    </div>
  );
}
