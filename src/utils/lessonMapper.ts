// src/utils/lessonMapper.ts (hoặc tên file hiện tại của bạn)
import type { Topic, Lesson, Difficulty } from '../lib/types';

const parseDifficulty = (diff: unknown): Difficulty => {
  const validDifficulties: Difficulty[] = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'F'];

  if (typeof diff === 'string' && validDifficulties.includes(diff as Difficulty)) {
    return diff as Difficulty;
  }
  return 'F';
};

export const mapTopic = (raw: Partial<Topic> & Record<string, unknown>): Topic => ({
  _id: String(raw._id || ''),
  title: String(raw.title || 'Untitled Topic'),
  description: String(raw.description || ''),
  difficulty: parseDifficulty(raw.difficulty),
  relevant_topic_ids: Array.isArray(raw.relevant_topic_ids) ? raw.relevant_topic_ids.map(String) : [],
  is_active: Boolean(raw.is_active ?? true),
});

export const mapLesson = (raw: Partial<Lesson> & Record<string, unknown>, fallbackTopicId: string = ''): Lesson => ({
  _id: String(raw._id || ''),
  topic_id: String(raw.topic_id || fallbackTopicId),
  title: String(raw.title || 'Untitled Lesson'),
  description: String(raw.description || ''),
  order: Number(raw.order || 0),
  difficulty: parseDifficulty(raw.difficulty),
  is_active: Boolean(raw.is_active ?? true),
});

export const extractTopics = (response: unknown): Topic[] => {
  const payload = (response as { data?: unknown })?.data ?? response;

  if (!Array.isArray(payload)) return [];
  return payload.map(item => mapTopic(item as Record<string, unknown>));
};

export const extractLessons = (response: unknown, fallbackTopicId: string = ''): Lesson[] => {
  const payload = (response as { data?: unknown })?.data ?? response;

  const rawArray = Array.isArray(payload) ? payload : (payload as { data?: unknown[] })?.data;

  if (!Array.isArray(rawArray)) return [];
  return rawArray.map(item => mapLesson(item as Record<string, unknown>, fallbackTopicId));
};

export const extractSingleLesson = (response: unknown): Lesson | null => {
  const payload = (response as { data?: unknown })?.data ?? response;

  if (!payload || typeof payload !== 'object' || !('_id' in payload)) {
    return null;
  }

  return mapLesson(payload as Record<string, unknown>);
};
