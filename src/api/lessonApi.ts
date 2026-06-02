import axiosClient from './axiosClient';
import type { Topic, Lesson, UserProgress, SubmitLessonResponse } from '../lib/types';

export const lessonApi = {
  getTopics: (): Promise<Topic[]> => {
    return axiosClient.get('/topics');
  },

  getLessonsByTopic: (topicId: string): Promise<Lesson[]> => {
    return axiosClient.get(`/topics/${topicId}/lessons`);
  },

  getLessonDetails: (lessonId: string): Promise<Lesson> => {
    return axiosClient.get(`/lessons/${lessonId}`);
  },

  saveDraftProgress: (lessonId: string, workspaceState: Record<string, unknown>): Promise<UserProgress> => {
    return axiosClient.post(`/lessons/${lessonId}/save-progress`, { workspaceState });
  },

  submitWorkspace: (
    lessonId: string,
    pythonCode: string,
    workspaceState: Record<string, unknown>,
    timeTaken: number,
  ): Promise<SubmitLessonResponse> => {
    return axiosClient.post(`/lessons/${lessonId}/submit`, {
      pythonCode,
      workspaceState,
      time: timeTaken,
    });
  },
};
