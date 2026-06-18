import axiosClient from './axiosClient';
import type { UserProgress } from '../lib/types';

export const progressApi = {
  getAllUserProgress: () => axiosClient.get<unknown, UserProgress[]>('/progress'),

  getUserLessonProgress: (lessonId: string) => axiosClient.get<unknown, UserProgress>(`/progress/${lessonId}`),
};
