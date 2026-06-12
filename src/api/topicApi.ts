import axiosClient from './axiosClient';
import type { Topic, Lesson } from '../lib/types';

export const topicApi = {
  getAllTopics: () => axiosClient.get<unknown, Topic[]>('/topics'),

  getLessonsByTopic: (topicId: string) => axiosClient.get<unknown, Lesson[]>(`/topics/${topicId}/lessons`),
};
