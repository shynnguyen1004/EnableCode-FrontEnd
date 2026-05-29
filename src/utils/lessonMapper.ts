/* eslint-disable @typescript-eslint/no-explicit-any */
// Tắt ESLint rule cho file này vì nó là trạm thu gom mọi loại cấu trúc rác từ Axios

import { FrontendTopic, FrontendLesson } from '../types';
import type { Difficulty } from '../lib/types';

// Xử lý đồng bộ Rank độ khó
const mapDifficulty = (diff?: string): Difficulty => {
  if (diff === 'easy' || diff === 'medium' || diff === 'hard') return diff;
  if (diff === 'beginner') return 'easy';
  return 'medium'; // Mặc định nếu API thiếu
};

// Phiên dịch 1 Topic
export const mapTopic = (raw: any): FrontendTopic => ({
  _id: raw._id,
  title: raw.title || 'Untitled Topic',
  description: raw.description || '',
  difficulty: mapDifficulty(raw.difficulty),
  relevant_topic_ids: raw.relevantTopicIds || raw.relevant_topic_ids || [],
  is_active: raw.isActive !== undefined ? raw.isActive : (raw.is_active ?? true),
});

// Phiên dịch 1 Lesson
export const mapLesson = (raw: any, fallbackTopicId: string = ''): FrontendLesson => ({
  _id: raw._id,
  topic_id: raw.topicId || raw.topic_id || fallbackTopicId,
  title: raw.title || 'Untitled Lesson',
  description: raw.description || '',
  order: raw.order || 0,
  difficulty: mapDifficulty(raw.difficulty),
  is_active: raw.isActive !== undefined ? raw.isActive : (raw.is_active ?? true),
});

// Hàm lấy mảng Topics từ Response hỗn loạn
export const extractTopics = (response: any): FrontendTopic[] => {
  const rawArray = response?.topics || response?.data?.topics || response;
  if (!Array.isArray(rawArray)) return [];
  return rawArray.map(mapTopic);
};

// Hàm lấy mảng Lessons từ Response hỗn loạn
export const extractLessons = (response: any, fallbackTopicId: string = ''): FrontendLesson[] => {
  const rawArray = response?.lessons || response?.data?.lessons || response;
  if (!Array.isArray(rawArray)) return [];
  return rawArray.map(l => mapLesson(l, fallbackTopicId));
};

// Hàm lấy 1 Lesson chi tiết
export const extractSingleLesson = (response: any): FrontendLesson | null => {
  const raw = response?.lesson || response?.data?.lesson || response;
  if (!raw || typeof raw !== 'object' || !raw._id) return null;
  return mapLesson(raw);
};
