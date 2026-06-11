import axiosClient from './axiosClient';
import { mockLessonApi } from './mockLessonApi';
import { isMockDataEnabled } from '../lib/mockData';
import type { Topic, Lesson, UserProgress, SubmitLessonResponse } from '../lib/types';

export const lessonApi = {
  getTopics: (): Promise<Topic[]> => {
    if (isMockDataEnabled) return mockLessonApi.getTopics();
    return axiosClient.get('/topics');
  },

  getLessonsByTopic: (topicId: string): Promise<Lesson[]> => {
    if (isMockDataEnabled) return mockLessonApi.getLessonsByTopic(topicId);
    return axiosClient.get(`/topics/${topicId}/lessons`);
  },

  getLessonDetails: (lessonId: string): Promise<Lesson> => {
    if (isMockDataEnabled) return mockLessonApi.getLessonDetails(lessonId);
    return axiosClient.get(`/lessons/${lessonId}`);
  },

  saveDraftProgress: (lessonId: string, workspaceState: Record<string, unknown>): Promise<UserProgress> => {
    if (isMockDataEnabled) return mockLessonApi.saveDraftProgress(lessonId, workspaceState);
    return axiosClient.post(`/lessons/${lessonId}/save-progress`, { workspaceState });
  },

  submitWorkspace: (
    lessonId: string,
    pythonCode: string,
    workspaceState: Record<string, unknown>,
    timeTaken: number,
  ): Promise<SubmitLessonResponse> => {
    if (isMockDataEnabled) {
      return mockLessonApi.submitWorkspace(lessonId, pythonCode, workspaceState, timeTaken);
    }
    return axiosClient.post(`/lessons/${lessonId}/submit`, {
      pythonCode,
      workspaceState,
      time: timeTaken,
    });
  },
};
