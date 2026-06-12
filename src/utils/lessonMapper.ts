import type { Topic, Lesson } from '../lib/types';
interface ApiResponse {
  topics?: Topic[];
  lessons?: Lesson[];
  lesson?: Lesson;
  data?: unknown;
}

export function extractTopics(apiResponse: unknown): Topic[] {
  if (!apiResponse) return [];

  if (Array.isArray(apiResponse)) {
    return apiResponse as Topic[];
  }

  const res = apiResponse as ApiResponse;
  return Array.isArray(res.topics) ? res.topics : [];
}

export function extractLessons(apiResponse: unknown): Lesson[] {
  if (!apiResponse) return [];

  if (Array.isArray(apiResponse)) {
    return apiResponse as Lesson[];
  }

  const res = apiResponse as ApiResponse;
  return Array.isArray(res.lessons) ? res.lessons : [];
}

export function extractSingleLesson(apiResponse: unknown): Lesson | null {
  if (!apiResponse || typeof apiResponse !== 'object') return null;

  const res = apiResponse as ApiResponse;
  const raw = res.lesson || res.data || apiResponse;

  if (!raw || typeof raw !== 'object' || raw === null) return null;

  const rawObj = raw as { _id?: unknown; [key: string]: unknown };
  if (typeof rawObj._id !== 'string') return null;

  const lesson = rawObj as {
    _id: string;
    title?: string;
    description?: string;
    order?: number;
    isActive?: boolean;
    is_active?: boolean;
    topicId?: string;
    topic_id?: string;
    difficulty?: string;
  };

  return {
    _id: lesson._id,
    title: lesson.title,
    description: lesson.description || '',
    order: lesson.order ?? 0,
    isActive: lesson.isActive ?? lesson.is_active ?? true,
    topicId: (lesson.topicId || lesson.topic_id) as string,
    difficulty: lesson.difficulty || 'beginner',
  } as Lesson;
}
