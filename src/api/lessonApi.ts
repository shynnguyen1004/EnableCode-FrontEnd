import axiosClient from './axiosClient';
import type {
  Lesson,
  UserProgress,
  SubmitLessonResponse,
  PaginatedLessonsResponse,
  HintResponse,
  CreateLessonRequest,
  UpdateLessonRequest,
  MessageResponse,
  SaveProgressRequest,
  SubmitLessonRequest,
} from '../lib/types';

export const lessonApi = {
  // ==========================================
  // STUDENT ACTIONS
  // ==========================================

  getLessons: (params?: { topicId?: string; difficulty?: string; isActive?: boolean; page?: number; limit?: number }) =>
    axiosClient.get<unknown, PaginatedLessonsResponse>('/lessons', { params }),

  getLessonDetails: (lessonId: string) => axiosClient.get<unknown, Lesson>(`/lessons/${lessonId}`),

  getLessonProgress: (lessonId: string) => axiosClient.get<unknown, UserProgress>(`/lessons/${lessonId}/progress`),

  saveDraftProgress: (lessonId: string, data: SaveProgressRequest) =>
    axiosClient.post<unknown, UserProgress>(`/lessons/${lessonId}/save-progress`, data),

  submitWorkspace: (lessonId: string, data: SubmitLessonRequest) =>
    axiosClient.post<unknown, SubmitLessonResponse>(`/lessons/${lessonId}/submit`, data),

  getHint: (lessonId: string, index: number = 0) =>
    axiosClient.get<unknown, HintResponse>(`/lessons/${lessonId}/hint`, { params: { index } }),

  viewSolution: (lessonId: string) =>
    axiosClient.post<unknown, { solution: Record<string, unknown> }>(`/lessons/${lessonId}/view-solution`),

  // ==========================================
  // ADMIN / TEACHER ACTIONS
  // ==========================================

  createLesson: (data: CreateLessonRequest) => axiosClient.post<unknown, Lesson>('/lessons', data),

  updateLesson: (lessonId: string, data: UpdateLessonRequest) =>
    axiosClient.put<unknown, Lesson>(`/lessons/${lessonId}`, data),

  deleteLesson: (lessonId: string) => axiosClient.delete<unknown, MessageResponse>(`/lessons/${lessonId}`),

  toggleActive: (lessonId: string) => axiosClient.patch<unknown, Lesson>(`/lessons/${lessonId}/toggle-active`),
};
