import type { Topic, Lesson } from '../lib/types';

interface ApiWrapper<T> {
  topics?: T[];
  lessons?: T[];
}

export function extractTopics(apiResponse: unknown): Topic[] {
  if (!apiResponse) return [];

  if (Array.isArray(apiResponse)) {
    return apiResponse as Topic[];
  }

  const res = apiResponse as ApiWrapper<Topic>;
  return Array.isArray(res.topics) ? res.topics : [];
}

export function extractLessons(apiResponse: unknown): Lesson[] {
  if (!apiResponse) return [];

  if (Array.isArray(apiResponse)) {
    return apiResponse as Lesson[];
  }

  const res = apiResponse as ApiWrapper<Lesson>;
  return Array.isArray(res.lessons) ? res.lessons : [];
}

export function extractSingleLesson(apiResponse: unknown): Lesson | null {
  if (!apiResponse) return null;
  const res = apiResponse as Record<string, unknown>;
  const raw = (res.lesson || res.data || res) as Record<string, unknown>;
  if (!raw || typeof raw._id !== 'string') return null;

  return {
    ...raw,
    topicId: (raw.topicId || raw.topic_id) as string,
  } as unknown as Lesson;
}
