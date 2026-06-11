import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play, Lightbulb, ChevronRight, Settings, RefreshCw, Loader2 } from 'lucide-react';
import * as Blockly from 'blockly';

import BlocklyEditor, { type BlocklyEditorHandle } from '../components/BlocklyEditor';
import WorkspaceOutputPanel from '../components/WorkspaceOutputPanel';
import { useI18n } from '../i18n/I18nProvider';
import { evaluateWorkspaceRun, type LogLine } from '../blockly/evaluateWorkspace';
import { isTopicLocked, isLessonLocked, markLessonCompleted } from '../lib/progress';
import { lessonApi } from '../api/lessonApi';
import { extractTopics, extractLessons, extractSingleLesson } from '../utils/lessonMapper';

import type { Topic, Lesson } from '../lib/types';

export default function WorkspacePage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { t, localizeLesson, localizeTopic } = useI18n();
  const editorRef = useRef<BlocklyEditorHandle>(null);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [lessonsInTopic, setLessonsInTopic] = useState<Lesson[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [outputLines, setOutputLines] = useState<LogLine[]>([]);
  const [outputOpen, setOutputOpen] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [runPassed, setRunPassed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!lessonId) return;

    const fetchData = async () => {
      try {
        const lessonRes = await lessonApi.getLessonDetails(lessonId);
        const fetchedLesson = extractSingleLesson(lessonRes);

        if (!fetchedLesson?.topicId) {
          setIsNotFound(true);
          return;
        }

        const [topicsRes, topicLessonsRes] = await Promise.all([
          lessonApi.getTopics(),
          lessonApi.getLessonsByTopic(fetchedLesson.topicId),
        ]);

        const matchedTopic = extractTopics(topicsRes).find(item => item._id === fetchedLesson.topicId);

        if (!matchedTopic) {
          setIsNotFound(true);
          return;
        }

        setLesson(fetchedLesson);
        setTopic(matchedTopic);
        setLessonsInTopic(extractLessons(topicLessonsRes).filter(item => item.isActive));
        setHintIndex(0);
        setOutputLines([]);
        setOutputOpen(false);
        setHasRun(false);
        setRunPassed(null);
      } catch (error) {
        console.error('Failed to fetch workspace data:', error);
        setIsNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [lessonId]);

  const handleReset = () => {
    editorRef.current?.resetWorkspace();
    setOutputLines([]);
    setOutputOpen(false);
    setHasRun(false);
    setRunPassed(null);
  };

  const handleClearOutput = () => {
    setOutputLines([]);
    setOutputOpen(false);
    setHasRun(false);
    setRunPassed(null);
  };

  const handleHint = () => {
    if (!lesson?.hint?.length) return;
    setHintIndex(index => Math.min(index + 1, lesson.hint.length));
  };

  const handleRunCode = async () => {
    if (!lessonId || !lesson || isSubmitting) return;

    const workspace = editorRef.current?.getWorkspace();
    if (!workspace) return;

    setIsSubmitting(true);
    setOutputLines([]);
    setRunPassed(null);
    setHasRun(true);
    setOutputOpen(true);

    try {
      const { output, logs } = evaluateWorkspaceRun(workspace);
      const isSandbox = lesson.toolboxConfig?.sandbox === true;
      const expected = lesson.publicTestcases[0]?.expectedOutput ?? '';
      const passed = isSandbox ? true : output.trim() === String(expected).trim();

      const resultLogs: LogLine[] = [...logs];
      if (passed) {
        resultLogs.push({
          id: 'result-pass',
          text: isSandbox ? t('workspace.outputSandboxDone') : t('workspace.outputPassedLine'),
          type: 'success',
        });
        if (!isSandbox) markLessonCompleted(lessonId);
        setRunPassed(true);
      } else {
        resultLogs.push({
          id: 'result-fail',
          text: t('workspace.outputFailedLine'),
          type: 'error',
        });
        setRunPassed(false);
      }

      setOutputLines(resultLogs);

      const workspaceState = Blockly.serialization.workspaces.save(workspace);
      await lessonApi.submitWorkspace(lessonId, output, workspaceState, 0);
    } catch (error) {
      console.error('Submit error:', error);
      setRunPassed(false);
      setOutputLines([{ id: 'run-error', text: t('workspace.runError'), type: 'error' }]);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!lessonId || isNotFound) return <Navigate to="/lessons" replace />;

  if (isLoading || !lesson || !topic) {
    return (
      <div className="workspace-page workspace-page--loading">
        <Loader2 size={40} className="workspace-spinner" />
        <p>{t('workspace.loading')}</p>
      </div>
    );
  }

  if (isTopicLocked(topic) || isLessonLocked(lesson, lessonsInTopic)) {
    return <Navigate to={`/lessons/${topic._id}`} replace />;
  }

  const topicPath = `/lessons/${topic._id}`;
  const localizedLesson = localizeLesson(lesson) || lesson;
  const localizedTopic = localizeTopic(topic) || topic;
  const activeHint = lesson.hint[Math.min(hintIndex, lesson.hint.length) - 1];

  return (
    <div className="workspace-page">
      <header className="workspace-topbar">
        <div className="workspace-left">
          <Link to={topicPath} className="workspace-icon-btn" aria-label={t('nav.backToLessons')}>
            <ArrowLeft size={28} strokeWidth={3} />
          </Link>
          <nav className="workspace-breadcrumbs" aria-label="Breadcrumb">
            <Link to="/lessons">{t('nav.topics')}</Link>
            <ChevronRight size={24} strokeWidth={4} className="crumb-icon" />
            <Link to={topicPath}>{localizedTopic.title}</Link>
            <ChevronRight size={24} strokeWidth={4} className="crumb-icon" />
            <strong>{localizedLesson.title}</strong>
          </nav>
        </div>
        <div className="workspace-right">
          <button className="workspace-icon-btn" type="button" aria-label={t('workspace.reset')} onClick={handleReset}>
            <RefreshCw size={28} strokeWidth={3} />
          </button>
          <Link to="/settings" className="workspace-icon-btn" aria-label={t('workspace.settings')}>
            <Settings size={28} strokeWidth={3} />
          </Link>
        </div>
      </header>

      <div className="workspace-body">
        <aside className="workspace-panel">
          <div className="workspace-panel-scroll">
            <div className="objective-chip">{t('workspace.objective')}</div>
            <h1>{localizedLesson.title}</h1>
            <div className="workspace-panel-copy">
              <p>{localizedLesson.description || lesson.problemStatement}</p>
              {lesson.problemStatement && localizedLesson.description !== lesson.problemStatement && (
                <p>{lesson.problemStatement}</p>
              )}
            </div>

            {activeHint && (
              <div className="workspace-hint-card">
                <strong>
                  {t('workspace.hintLabel')} {activeHint.level}
                </strong>
                <p>{activeHint.text}</p>
              </div>
            )}
          </div>

          <div className="workspace-panel-actions">
            <button type="button" className="workspace-panel-btn hint group" onClick={handleHint}>
              <Lightbulb size={36} strokeWidth={3} className="btn-icon text-orange" />
              {t('workspace.needHint')}
            </button>
            <button
              type="button"
              className={`workspace-panel-btn run group${isSubmitting ? ' is-disabled' : ''}`}
              onClick={handleRunCode}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 size={44} strokeWidth={3} className="btn-icon workspace-spinner" />
              ) : (
                <Play size={44} strokeWidth={3} className="btn-icon fill-current" />
              )}
              {isSubmitting ? t('workspace.running') : t('workspace.runCode')}
            </button>
          </div>
        </aside>

        <main className="workspace-stage">
          <div className="workspace-grid-bg" aria-hidden="true" />
          <div className="workspace-canvas">
            <BlocklyEditor
              ref={editorRef}
              lessonKey={lesson._id}
              toolboxConfig={lesson.toolboxConfig}
              initialBlocks={lesson.initialBlocks}
              toolboxTitle={t('workspace.blockLibrary')}
            />
          </div>
          <WorkspaceOutputPanel
            lines={outputLines}
            isOpen={outputOpen}
            isRunning={isSubmitting}
            hasRun={hasRun}
            passed={runPassed}
            title={t('workspace.outputTitle')}
            runningLabel={t('workspace.running')}
            passedLabel={t('workspace.outputPassed')}
            errorLabel={t('workspace.outputError')}
            placeholder={t('workspace.outputPlaceholder')}
            clearLabel={t('workspace.outputClear')}
            onToggleOpen={() => setOutputOpen(open => !open)}
            onClear={handleClearOutput}
          />
        </main>
      </div>
    </div>
  );
}
