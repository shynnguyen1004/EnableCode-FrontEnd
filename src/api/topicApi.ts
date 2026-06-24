import axiosClient from './axiosClient';
import type { Topic, TopicsListResponse, TopicLessonsResponse, MessageResponse } from '../lib/types';

export const topicApi = {
  // ==========================
  // PUBLIC / STUDENT ACTIONS
  // ==========================
  getAllTopics: () => axiosClient.get<unknown, TopicsListResponse>('/topics'),

  getLessonsByTopic: (topicId: string) => axiosClient.get<unknown, TopicLessonsResponse>(`/topics/${topicId}/lessons`),

  // ==========================
  // ADMIN / TEACHER ACTIONS
  // ==========================
  createTopic: (data: Partial<Topic>) => axiosClient.post<unknown, { success: boolean; topic: Topic }>('/topics', data),

  updateTopic: (topicId: string, data: Partial<Topic>) =>
    axiosClient.put<unknown, { success: boolean; topic: Topic }>(`/topics/${topicId}`, data),

  deleteTopic: (topicId: string) => axiosClient.delete<unknown, MessageResponse>(`/topics/${topicId}`),

  toggleActive: (topicId: string) =>
    axiosClient.patch<unknown, { success: boolean; topic: Topic }>(`/topics/${topicId}/toggle-active`),
};
