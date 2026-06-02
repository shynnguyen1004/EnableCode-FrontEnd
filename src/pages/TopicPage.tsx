import { useEffect, useState } from 'react';
import CourseCardGrid, { type CourseCardItem } from '../components/CourseCardGrid';
import CourseSidebar from '../components/CourseSidebar';
import { useI18n } from '../i18n/I18nProvider';

import type { Topic } from '../lib/types';
import { cardTone } from '../lib/curriculum';
import { isTopicLocked, getTopicProgressPercent } from '../lib/progress';
import { lessonApi } from '../api/lessonApi';
import { extractTopics } from '../utils/lessonMapper';
import { Loader2 } from 'lucide-react';

export default function TopicPage() {
  const { t, localizeTopic, difficultyLabel } = useI18n();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const res = await lessonApi.getTopics();
        const formattedTopics = extractTopics(res);

        setTopics(formattedTopics.filter(topic => topic.isActive));
      } catch (error) {
        console.error('Failed to fetch topics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopics();
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
    return {
      id: topic._id,
      title: localized.title,
      description: localized.description || '',
      progress: getTopicProgressPercent(topic._id),
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
