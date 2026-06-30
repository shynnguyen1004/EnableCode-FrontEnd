import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play, Lightbulb, ChevronRight, Settings, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';
import { isAxiosError } from 'axios';
import * as Blockly from 'blockly';
import ReactMarkdown from 'react-markdown';

import BlocklyEditor, { type BlocklyEditorHandle } from '../components/BlocklyEditor';
import WorkspaceOutputPanel from '../components/WorkspaceOutputPanel';
import { useI18n } from '../i18n/I18nProvider';
import { evaluateWorkspaceRun, type LogLine } from '../blockly/evaluateWorkspace';
import { isTopicLocked, isLessonLocked } from '../lib/progress';
import { lessonApi } from '../api/lessonApi';
import { topicApi } from '../api/topicApi';
import { progressApi } from '../api/progressApi';
import { profileApi } from '../api/profileApi';
import { extractTopics, extractLessons, extractSingleLesson } from '../utils/lessonMapper';
import { registerDynamicBlocks } from '../blockly/blocks';

import type { Topic, Lesson, UserProgress } from '../lib/types';

export default function WorkspacePage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const { t, localizeLesson, localizeTopic } = useI18n();
  const editorRef = useRef<BlocklyEditorHandle>(null);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [lessonsInTopic, setLessonsInTopic] = useState<Lesson[]>([]);
  const [userProgressList, setUserProgressList] = useState<UserProgress[]>([]);
  const [currentLessonProgress, setCurrentLessonProgress] = useState<UserProgress | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmittingLesson, setIsSubmittingLesson] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submittedPoints, setSubmittedPoints] = useState(0);
  const [submittedLevel, setSubmittedLevel] = useState(0);
  const [submittedFromLevel, setSubmittedFromLevel] = useState(0);
  const [submittedFromLevelProgress, setSubmittedFromLevelProgress] = useState(0);
  const [submittedLevelProgress, setSubmittedLevelProgress] = useState(0);
  const [animatedLevelProgress, setAnimatedLevelProgress] = useState(0);
  const levelAnimationTimeoutRef = useRef<number | null>(null);
  const [hintIndex, setHintIndex] = useState(0);
  const hasMoreHints = !!(lesson?.hint && lesson.hint.length > 0 && hintIndex < lesson.hint.length);
  const [outputLines, setOutputLines] = useState<LogLine[]>([]);
  const [outputOpen, setOutputOpen] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [runPassed, setRunPassed] = useState<boolean | null>(null);
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  useEffect(() => {
    if (!lessonId) return;

    const fetchWorkspaceData = async () => {
      try {
        const lessonRes = await lessonApi.getLessonDetails(lessonId);
        const fetchedLesson = extractSingleLesson(lessonRes);
        const requiredBlocks = lessonRes.requiredBlocks || [];
        if (!fetchedLesson?.topicId) {
          setIsNotFound(true);
          return;
        }
        if (requiredBlocks.length > 0) {
          registerDynamicBlocks(requiredBlocks);
        }
        const actualTopicId = fetchedLesson.topicId;

        const [topicsRes, topicLessonsRes, allProgressRes, detailProgressRes] = await Promise.all([
          topicApi.getAllTopics(),
          topicApi.getLessonsByTopic(actualTopicId),
          progressApi.getAllUserProgress(),
          progressApi.getUserLessonProgress(lessonId),
        ]);

        const rawTopics = extractTopics(topicsRes);
        const rawLessons = extractLessons(topicLessonsRes);
        const matchedTopic = rawTopics.find(item => item._id === actualTopicId);
        if (!matchedTopic) {
          setIsNotFound(true);
          return;
        }
        setCurrentLessonProgress(detailProgressRes);
        setLesson(fetchedLesson);
        setTopic(matchedTopic);
        setLessonsInTopic(rawLessons.filter(item => item.isActive));
        setUserProgressList(allProgressRes);
        setHintIndex(0);
        setOutputLines([]);
        setOutputOpen(false);
        setHasRun(false);
        setRunPassed(null);
        setIsSubmitModalOpen(false);
        setSubmittedPoints(0);
      } catch (error) {
        console.error('Failed to fetch workspace data:', error);
        setIsNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkspaceData();
  }, [lessonId]);

  const handleReset = () => {
    editorRef.current?.resetWorkspace();
    setOutputLines([]);
    setOutputOpen(false);
    setHasRun(false);
    setRunPassed(null);
    setIsSubmitModalOpen(false);
    setSubmittedPoints(0);
    setSubmittedLevel(0);
    setSubmittedLevelProgress(0);
    setAnimatedLevelProgress(0);
  };

  const handleClearOutput = () => {
    setOutputLines([]);
    setOutputOpen(false);
    setHasRun(false);
    setRunPassed(null);
    setIsSubmitModalOpen(false);
    setSubmittedPoints(0);
    setSubmittedLevel(0);
    setSubmittedLevelProgress(0);
    setAnimatedLevelProgress(0);
  };

  useEffect(() => {
    if (!isSubmitModalOpen) return;

    if (levelAnimationTimeoutRef.current !== null) {
      window.clearTimeout(levelAnimationTimeoutRef.current);
      levelAnimationTimeoutRef.current = null;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      setAnimatedLevelProgress(submittedFromLevelProgress);

      const nextFrame = window.requestAnimationFrame(() => {
        if (submittedLevel > submittedFromLevel) {
          // Qua mốc level mới: chạy đến 100%, rồi reset và chạy tiếp đến mức mới.
          setAnimatedLevelProgress(100);
          levelAnimationTimeoutRef.current = window.setTimeout(() => {
            setAnimatedLevelProgress(0);
            const secondFrame = window.requestAnimationFrame(() => {
              setAnimatedLevelProgress(submittedLevelProgress);
            });
            levelAnimationTimeoutRef.current = window.setTimeout(() => {
              window.cancelAnimationFrame(secondFrame);
              levelAnimationTimeoutRef.current = null;
            }, 0);
          }, 900);
        } else {
          setAnimatedLevelProgress(submittedLevelProgress);
        }
      });

      levelAnimationTimeoutRef.current = window.setTimeout(() => {
        window.cancelAnimationFrame(nextFrame);
      }, 0);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      if (levelAnimationTimeoutRef.current !== null) {
        window.clearTimeout(levelAnimationTimeoutRef.current);
        levelAnimationTimeoutRef.current = null;
      }
    };
  }, [isSubmitModalOpen, submittedFromLevel, submittedFromLevelProgress, submittedLevel, submittedLevelProgress]);

  const handleHint = () => {
    if (!lesson?.hint?.length) return;
    setHintIndex(index => Math.min(index + 1, lesson.hint.length));
  };

  const appendTestcaseLogs = (
    resultLogs: LogLine[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    testcaseResults: any[] | undefined,
  ) => {
    if (!testcaseResults || !Array.isArray(testcaseResults)) return;

    resultLogs.push({
      id: 'testcase-header',
      text: '--- Testcases ---',
      type: 'dim',
    });

    testcaseResults.forEach((tc, index) => {
      const isPass = tc.passed;
      const icon = isPass ? '✓' : '✗';

      resultLogs.push({
        id: `tc-${index}-status`,
        text: `${icon} Testcase ${index + 1}: ${tc.description}`,
        type: isPass ? 'success' : 'error',
      });
      if (!isPass) {
        resultLogs.push({
          id: `tc-${index}-expected`,
          text: `    Expected: ${tc.expectedOutput}`,
          type: 'dim',
        });
        resultLogs.push({
          id: `tc-${index}-actual`,
          text: `    Actual:   ${tc.actualOutput}`,
          type: 'dim',
        });
      }
    });

    resultLogs.push({
      id: 'testcase-footer',
      text: '-----------------',
      type: 'dim',
    });
  };

  const handleRunCode = async () => {
    if (!lessonId || !lesson || isRunning) return;

    const workspace = editorRef.current?.getWorkspace();
    if (!workspace) return;

    setIsRunning(true);
    setOutputLines([]);
    setRunPassed(null);
    setHasRun(true);
    setOutputOpen(true);
    setIsSubmitModalOpen(false);
    setSubmittedPoints(0);

    try {
      const { output, logs } = evaluateWorkspaceRun(workspace);
      const isSandbox = lesson.toolboxConfig?.sandbox === true;
      const resultLogs: LogLine[] = [...logs];
      let passed = false;
      let programOutput = '';

      if (isSandbox) {
        passed = true;
      } else {
        const response = await lessonApi.runWorkspace(lessonId, { pythonCode: output });
        programOutput = response.output ?? '';
        passed = response.passed ?? output.trim() === String(lesson.publicTestcases[0]?.expectedOutput ?? '').trim();

        if (programOutput) {
          resultLogs.push({
            id: 'program-output',
            text: `▶ Output:\n${programOutput}\n`,
            type: 'info',
          });
        }

        appendTestcaseLogs(resultLogs, response.testcaseResults);
      }

      if (passed) {
        resultLogs.push({
          id: 'result-pass',
          text: isSandbox ? t('workspace.outputSandboxDone') : t('workspace.outputPassedLine'),
          type: 'success',
        });
        setRunPassed(true);
      } else {
        resultLogs.push({
          id: 'result-fail',
          text: programOutput
            ? `${t('workspace.outputFailedLine')}\n${programOutput}`
            : t('workspace.outputFailedLine'),
          type: 'error',
        });
        setRunPassed(false);
      }

      setOutputLines(resultLogs);
    } catch (error) {
      console.error('Run error:', error);
      setRunPassed(false);

      const message = isAxiosError(error)
        ? String(error.response?.data?.error?.message ?? t('workspace.runError'))
        : t('workspace.runError');

      setOutputLines([{ id: 'run-error', text: message, type: 'error' }]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSubmit = async () => {
    if (!lessonId || !lesson || isSubmittingLesson || runPassed !== true) return;

    const workspace = editorRef.current?.getWorkspace();
    if (!workspace) return;

    setIsSubmittingLesson(true);

    try {
      const beforeSubmitStats = await profileApi.getUserStats();
      const beforeScore = beforeSubmitStats.totalScore ?? 0;
      const beforeLevel = beforeSubmitStats.level ?? 0;
      const beforeProgressToNextLevel = ((beforeScore % 100) + 100) % 100;

      const { output } = evaluateWorkspaceRun(workspace);
      const workspaceState = Blockly.serialization.workspaces.save(workspace);

      const response = await lessonApi.submitWorkspace(lessonId, {
        workspaceState,
        pythonCode: output,
        time: 0,
      });

      if (response.passed) {
        setSubmittedPoints(response.points ?? 0);
        const userStats = await profileApi.getUserStats();
        const totalScore = userStats.totalScore ?? 0;
        const level = userStats.level ?? 0;
        const progressToNextLevel = ((totalScore % 100) + 100) % 100;

        setSubmittedFromLevel(beforeLevel);
        setSubmittedFromLevelProgress(beforeProgressToNextLevel);
        setSubmittedLevel(level);
        setSubmittedLevelProgress(progressToNextLevel);
        setIsSubmitModalOpen(true);

        const [updatedAllProgress, updatedDetailProgress] = await Promise.all([
          progressApi.getAllUserProgress(),
          progressApi.getUserLessonProgress(lessonId),
        ]);

        setUserProgressList(updatedAllProgress);
        setCurrentLessonProgress(updatedDetailProgress);
      }
    } catch (error) {
      console.error('Submit error:', error);

      const message = isAxiosError(error)
        ? String(error.response?.data?.error?.message ?? t('workspace.runError'))
        : t('workspace.runError');

      setOutputLines([{ id: 'submit-error', text: message, type: 'error' }]);
      setOutputOpen(true);
    } finally {
      setIsSubmittingLesson(false);
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

  if (isTopicLocked(topic) || isLessonLocked(lesson, lessonsInTopic, userProgressList)) {
    return <Navigate to={`/lessons/${topic._id}`} replace />;
  }

  const topicPath = `/lessons/${topic._id}`;
  const localizedLesson = localizeLesson(lesson) || lesson;
  const localizedTopic = localizeTopic(topic) || topic;
  const activeHint = lesson.hint[Math.min(hintIndex, lesson.hint.length) - 1];
  const showSubmitButton = runPassed === true;

  const nextLesson = (() => {
    const sortedLessons = [...lessonsInTopic].sort((left, right) => left.order - right.order);
    const currentIndex = sortedLessons.findIndex(item => item._id === lesson._id);
    if (currentIndex < 0 || currentIndex >= sortedLessons.length - 1) return null;
    return sortedLessons[currentIndex + 1];
  })();

  const handleNextLesson = () => {
    setIsSubmitModalOpen(false);
    if (nextLesson) {
      navigate(`/workspace/${nextLesson._id}`);
      return;
    }
    navigate(topicPath);
  };

  const submitSuccessMessage =
    submittedPoints > 0
      ? t('workspace.submitSuccessPoints').replace('{points}', String(submittedPoints))
      : t('workspace.submitSuccessNoPoints');
  const pointsToNextLevel = 100 - submittedLevelProgress;

  const savedWorkspaceState = currentLessonProgress?.workspaceState;
  return (
    <div className="workspace-page">
      <header className="workspace-topbar">
        <div className="workspace-left">
          <Link to={topicPath} className="workspace-icon-btn" aria-label={t('nav.backToLessons')}>
            <ArrowLeft size={36} strokeWidth={3} />
          </Link>
          <nav className="workspace-breadcrumbs" aria-label="Breadcrumb">
            <Link to="/lessons">{t('nav.topics')}</Link>
            <ChevronRight size={28} strokeWidth={4} className="crumb-icon" />
            <Link to={topicPath}>{localizedTopic.title}</Link>
            <ChevronRight size={28} strokeWidth={4} className="crumb-icon" />
            <strong>{localizedLesson.title}</strong>
          </nav>
        </div>
        <div className="workspace-right">
          <button className="workspace-icon-btn" type="button" aria-label={t('workspace.reset')} onClick={handleReset}>
            <RefreshCw size={36} strokeWidth={3} />
          </button>
          <Link to="/settings" className="workspace-icon-btn" aria-label={t('workspace.settings')}>
            <Settings size={36} strokeWidth={3} />
          </Link>
        </div>
      </header>

      <div className="workspace-body">
        <aside className="workspace-panel">
          <div id="draggable" className="workspace-panel-scroll">
            <div className="objective-chip">{t('workspace.objective')}</div>
            <h1>{localizedLesson.title}</h1>
            <div className="workspace-panel-copy">
              <ReactMarkdown>{localizedLesson.description || lesson.description || ''}</ReactMarkdown>
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
            {showSubmitButton ? (
              <button
                type="button"
                className={`workspace-panel-btn submit group${isSubmittingLesson ? ' is-disabled' : ''}`}
                onClick={handleSubmit}
                disabled={isSubmittingLesson}
              >
                {isSubmittingLesson ? (
                  <Loader2 size={36} strokeWidth={3} className="btn-icon workspace-spinner" />
                ) : (
                  <CheckCircle2 size={36} strokeWidth={3} className="btn-icon" />
                )}
                {isSubmittingLesson ? t('workspace.submitting') : t('workspace.submit')}
              </button>
            ) : (
              <div style={{ cursor: hasMoreHints ? 'pointer' : 'not-allowed' }}>
                <button
                  type="button"
                  className="workspace-panel-btn hint group"
                  onClick={handleHint}
                  disabled={!hasMoreHints}
                  style={{
                    opacity: hasMoreHints ? 1 : 0.5,
                    pointerEvents: hasMoreHints ? 'auto' : 'none',
                    width: '100%',
                  }}
                >
                  <Lightbulb size={36} strokeWidth={3} className="btn-icon text-orange" />
                  {t('workspace.needHint')}
                </button>
              </div>
            )}
            <button
              type="button"
              className={`workspace-panel-btn run group${isRunning ? ' is-disabled' : ''}`}
              onClick={handleRunCode}
              disabled={isRunning}
            >
              {isRunning ? (
                <Loader2 size={44} strokeWidth={3} className="btn-icon workspace-spinner" />
              ) : (
                <Play size={44} strokeWidth={3} className="btn-icon fill-current" />
              )}
              {isRunning ? t('workspace.running') : t('workspace.runCode')}
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
              savedWorkspaceState={savedWorkspaceState}
              initialBlocks={lesson.initialBlocks}
              toolboxTitle={t('workspace.blockLibrary')}
            />
          </div>
          <WorkspaceOutputPanel
            lines={outputLines}
            isOpen={outputOpen}
            isRunning={isRunning}
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

      {isSubmitModalOpen && (
        <div className="workspace-submit-overlay" role="presentation">
          <div
            className="workspace-submit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-submit-title"
          >
            <div className="workspace-submit-modal-icon" aria-hidden="true">
              <CheckCircle2 size={40} strokeWidth={3} />
            </div>
            <h3 id="workspace-submit-title">{t('workspace.submitSuccessTitle')}</h3>
            <p>{submitSuccessMessage}</p>
            <div className="workspace-submit-level-card" aria-label="Level progress">
              <div className="workspace-submit-level-row">
                <span className="workspace-submit-level-label">Level</span>
                <span className="workspace-submit-level-value">{submittedLevel}</span>
              </div>
              <div className="workspace-submit-level-row workspace-submit-level-row--sub">
                <span className="workspace-submit-level-subtext">{submittedLevelProgress}/100 points</span>
                <span className="workspace-submit-level-subtext">{pointsToNextLevel} to next</span>
              </div>
              <div
                className="workspace-submit-level-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={submittedLevelProgress}
              >
                <div className="workspace-submit-level-bar-fill" style={{ width: `${animatedLevelProgress}%` }} />
              </div>
            </div>
            <div className="workspace-submit-modal-actions">
              <button type="button" className="workspace-submit-next-btn" onClick={handleNextLesson}>
                {nextLesson ? t('workspace.nextLesson') : t('workspace.backToTopic')}
                <ChevronRight size={28} strokeWidth={3} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
