import { useEffect, useState } from 'react';
import CourseCardGrid, { type CourseCardItem } from '../components/CourseCardGrid';
import CourseSidebar from '../components/CourseSidebar';
import { useI18n } from '../i18n/I18nProvider';
import { cardTone } from '../lib/curriculum';
import { isTopicLocked, getTopicProgressPercent } from '../lib/progress';
import { lessonApi } from '../api/lessonApi';
import { extractTopics } from '../utils/lessonMapper';
import { FrontendTopic } from '../types';

// Giao thoa type mượt mà
type LegacyTopic = Parameters<ReturnType<typeof useI18n>['localizeTopic']>[0] & Parameters<typeof isTopicLocked>[0];
type CompatibleTopic = FrontendTopic & LegacyTopic;

export default function TopicPage() {
  const { t, localizeTopic, difficultyLabel } = useI18n();

  const [topics, setTopics] = useState<CompatibleTopic[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const response = await lessonApi.getTopics();

        // Bóc tách bằng Mapper (1 dòng duy nhất)
        const rawTopics = extractTopics(response);

        // Ép kiểu chuẩn
        setTopics(rawTopics as unknown as CompatibleTopic[]);
      } catch (error) {
        console.error('Failed to fetch topics from server:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopics();
  }, []);

  const items: CourseCardItem[] = topics.map((topic, index) => {
    const localized = localizeTopic(topic) || topic;

    return {
      id: topic._id,
      title: `${index + 1}. ${localized.title}`,
      description: localized.description,
      progress: getTopicProgressPercent(topic._id),
      difficulty: difficultyLabel(topic.difficulty), // Mapper đã lo vụ này, không cần logic if-else nữa!
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

        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
            <p>Loading curriculum...</p>
          </div>
        ) : (
          <CourseCardGrid items={items} />
        )}
      </main>
    </div>
  );
}
