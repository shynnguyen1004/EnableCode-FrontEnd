import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play, Lightbulb, ChevronRight, GripVertical, Settings, RefreshCw, Loader2 } from 'lucide-react';

import { useI18n } from '../i18n/I18nProvider';
import { isTopicLocked, isLessonLocked, markLessonCompleted } from '../lib/progress';
import { lessonApi } from '../api/lessonApi';
import { extractTopics, extractLessons, extractSingleLesson } from '../utils/lessonMapper';

import type { Topic, Lesson } from '../lib/types';

export default function WorkspacePage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { t, localizeLesson, localizeTopic } = useI18n();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [lessonsInTopic, setLessonsInTopic] = useState<Lesson[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (!lessonId) return;

    const fetchData = async () => {
      try {
        const lessonRes = await lessonApi.getLessonDetails(lessonId);
        const fetchedLesson = extractSingleLesson(lessonRes);

        if (!fetchedLesson) {
          setIsNotFound(true);
          return;
        }

        const actualTopicId = fetchedLesson.topicId;

        if (!actualTopicId) {
          console.error(fetchedLesson);
          setIsNotFound(true);
          return;
        }

        const [topicsRes, topicLessonsRes] = await Promise.all([
          lessonApi.getTopics(),
          lessonApi.getLessonsByTopic(actualTopicId),
        ]);

        const rawTopics = extractTopics(topicsRes);
        const rawLessons = extractLessons(topicLessonsRes);

        const matchedTopic = rawTopics.find(t => t._id === actualTopicId);

        if (!matchedTopic) {
          setIsNotFound(true);
          return;
        }

        setLesson(fetchedLesson);
        setTopic(matchedTopic);
        setLessonsInTopic(rawLessons.filter(l => l.isActive));
      } catch (error) {
        console.error('Failed to fetch workspace data:', error);
        setIsNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [lessonId]);

  const handleRunCode = async () => {
    if (!lessonId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const generatedCode = "print('Hello Enable Code!')";
      console.log('Submitting string code payload:', generatedCode);

      await new Promise(resolve => setTimeout(resolve, 1500));
      const isPassed = true;

      if (isPassed) {
        markLessonCompleted(lessonId);
      } else {
        alert('There is an issue with your code. Let us check again!');
      }
    } catch (error) {
      console.error('Submit error:', error);
      alert('An error occurred while connecting to the judging server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!lessonId || isNotFound) return <Navigate to="/lessons" replace />;

  if (isLoading || !lesson || !topic) {
    return (
      <div
        className="workspace-page"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}
      >
        <Loader2 size={40} className="animate-spin text-orange-500 mr-3" />
        <p style={{ color: '#666', fontSize: '1.2rem', fontWeight: 500 }}>Loading workspace...</p>
      </div>
    );
  }

  if (isTopicLocked(topic) || isLessonLocked(lesson, lessonsInTopic)) {
    return <Navigate to={`/lessons/${topic._id}`} replace />;
  }

  const topicPath = `/lessons/${topic._id}`;
  const localizedLesson = localizeLesson(lesson) || lesson;
  const localizedTopic = localizeTopic(topic) || topic;

  return (
    <div className="workspace-page">
      <header className="workspace-topbar">
        <div className="workspace-left">
          <Link to={topicPath} className="workspace-icon-btn" aria-label={t('nav.backToLessons')}>
            <ArrowLeft size={28} strokeWidth={3} />
          </Link>
          <nav className="workspace-breadcrumbs">
            <Link to="/lessons">{t('nav.topics')}</Link>
            <ChevronRight size={24} strokeWidth={4} className="crumb-icon" />
            <Link to={topicPath}>{localizedTopic.title}</Link>
            <ChevronRight size={24} strokeWidth={4} className="crumb-icon" />
            <strong>{localizedLesson.title}</strong>
          </nav>
        </div>
        <div className="workspace-right">
          <button className="workspace-icon-btn" type="button" aria-label={t('workspace.reset')}>
            <RefreshCw size={28} strokeWidth={3} />
          </button>
          <Link to="/settings" className="workspace-icon-btn" aria-label={t('workspace.settings')}>
            <Settings size={28} strokeWidth={3} />
          </Link>
        </div>
      </header>

      <div className="workspace-main">
        <aside className="workspace-panel">
          <div className="objective-chip">{t('workspace.objective')}</div>
          <h1>{localizedLesson.title}</h1>
          <p>{localizedLesson.description || ''}</p>

          <div className="workspace-panel-actions">
            <button type="button" className="workspace-panel-btn hint group">
              <Lightbulb size={36} strokeWidth={3} className="btn-icon text-orange" />
              {t('workspace.needHint')}
            </button>
            <button
              type="button"
              className={`workspace-panel-btn run group ${isSubmitting ? 'opacity-75 cursor-not-allowed' : ''}`}
              onClick={handleRunCode}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 size={44} strokeWidth={3} className="btn-icon text-white animate-spin" />
              ) : (
                <Play size={44} strokeWidth={3} className="btn-icon fill-current" />
              )}
              {isSubmitting ? 'Running...' : t('workspace.runCode')}
            </button>
          </div>
        </aside>

        <main className="workspace-canvas">
          <section className="blocks-zone">
            <div className="block start">
              <div className="drag-handle">
                <GripVertical size={32} />
              </div>
              <span>{t('workspace.onStart')}</span>
            </div>
            <div className="drop-ghost">{t('workspace.dropNext')}</div>
          </section>

          <aside className="workspace-library">
            <h3>{t('workspace.blockLibrary')}</h3>
            <p className="workspace-library-note">{t('workspace.blocklySoon')}</p>
          </aside>
        </main>
      </div>
    </div>
  );
}
