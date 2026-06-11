import { getLessonById, getLessonsByTopicId, topics } from '../lib/curriculum';
import type { Lesson, SubmitLessonResponse, Topic, UserProgress } from '../lib/types';
import { normalizeLesson, normalizeTopic } from '../utils/lessonMapper';

const mockDelay = () => new Promise(resolve => setTimeout(resolve, 80));

export const mockLessonApi = {
  async getTopics(): Promise<Topic[]> {
    await mockDelay();
    return topics.map(topic => normalizeTopic(topic as unknown as Record<string, unknown>));
  },

  async getLessonsByTopic(topicId: string): Promise<Lesson[]> {
    await mockDelay();
    return getLessonsByTopicId(topicId).map(lesson => normalizeLesson(lesson as unknown as Record<string, unknown>));
  },

  async getLessonDetails(lessonId: string): Promise<Lesson> {
    await mockDelay();
    const lesson = getLessonById(lessonId);
    if (!lesson) {
      throw new Error(`Lesson not found: ${lessonId}`);
    }
    return normalizeLesson(lesson as unknown as Record<string, unknown>);
  },

  async saveDraftProgress(lessonId: string, workspaceState: Record<string, unknown>): Promise<UserProgress> {
    await mockDelay();
    return {
      _id: `mock-progress-${lessonId}`,
      userId: 'mock-user',
      lessonId,
      status: 'in_progress',
      attemptsCount: 0,
      hintsRevealed: [],
      hasViewedSolution: false,
      workspaceState,
      time: 0,
      points: 0,
      submittedAt: null,
    };
  },

  async submitWorkspace(
    lessonId: string,
    _pythonCode: string,
    workspaceState: Record<string, unknown>,
    timeTaken: number,
  ): Promise<SubmitLessonResponse> {
    await mockDelay();
    return {
      progress: {
        _id: `mock-progress-${lessonId}`,
        userId: 'mock-user',
        lessonId,
        status: 'completed',
        attemptsCount: 1,
        hintsRevealed: [],
        hasViewedSolution: false,
        workspaceState,
        time: timeTaken,
        points: 30,
        submittedAt: new Date().toISOString(),
      },
      passed: true,
      points: 30,
      output: 'Xin chào Blockly!',
      testcaseResults: [],
    };
  },
};
