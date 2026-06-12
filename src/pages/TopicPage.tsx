import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import CourseCardGrid, { type CourseCardItem } from '../components/CourseCardGrid';
import CourseSidebar from '../components/CourseSidebar';
import { useI18n } from '../i18n/I18nProvider';
import type { Topic, Lesson, UserProgress } from '../lib/types';
import { cardTone } from '../lib/curriculum';
import { isTopicLocked, calculateTopicCompletionPercentage } from '../lib/progress';
import { topicApi } from '../api/topicApi';
import { lessonApi } from '../api/lessonApi';
import { progressApi } from '../api/progressApi';
import { extractTopics } from '../utils/lessonMapper';

export default function TopicPage() {
  const { t, localizeTopic, difficultyLabel } = useI18n();

  const [topics, setTopics] = useState<Topic[]>([]);
  // Thêm 2 state để chứa dữ liệu tính toán Progress
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [userProgressList, setUserProgressList] = useState<UserProgress[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [topicsRes, lessonsRes, progressRes] = await Promise.all([
          topicApi.getAllTopics(),
          lessonApi.getLessons({ limit: 1000 }),
          progressApi.getAllUserProgress(),
        ]);

        const formattedTopics = extractTopics(topicsRes);

        setTopics(formattedTopics.filter(topic => topic.isActive));

        setAllLessons(lessonsRes.lessons || []);
        setUserProgressList(progressRes);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="lessons-page">
        <CourseSidebar active="lessons" />
        <main className="lessons-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={40} className="animate-spin text-orange-500 mr-3" />
          <p style={{ color: '#666', fontSize: '1.2rem', fontWeight: 500 }}>Loading topics...</p>
        </main>
      </div>
    );
  }

  const items: CourseCardItem[] = topics.map((topic, index) => {
    const localized = localizeTopic(topic) || topic;

    const topicLessons = allLessons.filter(lesson => lesson.topicId === topic._id);

    return {
      id: topic._id,
      title: localized.title,
      description: localized.description || '',
      progress: calculateTopicCompletionPercentage(topicLessons, userProgressList),
      difficulty: difficultyLabel(topic.difficulty),
      locked: isTopicLocked(topic),
      tone: cardTone(index),
      href: `/lessons/${topic._id}`,
    };
  });

  return (
    <div className="lessons-page">
      <CourseSidebar active="lessons" />

      <main className="lessons-content">
        <header className="lessons-header">
          <h1>{t('topics.dashboardTitle')}</h1>
          <p>{t('topics.dashboardSubtitle')}</p>
        </header>

        <CourseCardGrid items={items} />
      </main>
    </div>
  );
}
