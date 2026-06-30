import axiosClient from './axiosClient';
import type {
  Lesson,
  UserProgressResponse,
  SaveProgressResponse,
  SaveProgressRequest,
  SubmitLessonResponse,
  RunLessonResponse,
  UpdateLessonRequest,
  PaginatedLessonsResponse,
  HintResponse,
  CreateLessonRequest,
  MessageResponse,
  SubmitLessonRequest,
  LessonDetailResponse,
} from '../lib/types';

export const lessonApi = {
  // ==========================================
  // STUDENT ACTIONS
  // ==========================================

  getLessons: (params?: { topicId?: string; difficulty?: string; isActive?: boolean; page?: number; limit?: number }) =>
    axiosClient.get<unknown, PaginatedLessonsResponse>('/lessons', { params }),

  getLessonDetails: (lessonId: string) => axiosClient.get<unknown, LessonDetailResponse>(`/lessons/${lessonId}`),

  getLessonProgress: (lessonId: string) =>
    axiosClient.get<unknown, UserProgressResponse>(`/lessons/${lessonId}/progress`),

  saveDraftProgress: (lessonId: string, data: SaveProgressRequest) =>
    axiosClient.post<unknown, SaveProgressResponse>(`/lessons/${lessonId}/save-progress`, data),

  submitWorkspace: (lessonId: string, data: SubmitLessonRequest) =>
    axiosClient.post<unknown, SubmitLessonResponse>(`/lessons/${lessonId}/submit`, data),

  runWorkspace: (lessonId: string, data: Pick<SubmitLessonRequest, 'pythonCode'>) =>
    axiosClient.post<unknown, RunLessonResponse>(`/lessons/${lessonId}/run`, data),

  getHint: (lessonId: string, index: number = 0) =>
    axiosClient.get<unknown, HintResponse>(`/lessons/${lessonId}/hint`, { params: { index } }),

  viewSolution: (lessonId: string) =>
    axiosClient.post<unknown, { success: boolean; solution: Record<string, unknown> }>(
      `/lessons/${lessonId}/view-solution`,
    ),

  // ==========================================
  // ADMIN / TEACHER ACTIONS
  // ==========================================

  createLesson: (data: CreateLessonRequest) =>
    axiosClient.post<unknown, { success: boolean; message: string; lesson: Lesson }>('/lessons', data),

  updateLesson: (lessonId: string, data: UpdateLessonRequest) =>
    axiosClient.put<unknown, { success: boolean; message: string; lesson: Lesson }>(`/lessons/${lessonId}`, data),

  deleteLesson: (lessonId: string) => axiosClient.delete<unknown, MessageResponse>(`/lessons/${lessonId}`),

  toggleActive: (lessonId: string) =>
    axiosClient.patch<unknown, { success: boolean; message: string; lesson: { _id: string; isActive: boolean } }>(
      `/lessons/${lessonId}/toggle-active`,
    ),
};
