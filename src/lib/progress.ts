// src/lib/progress.ts
import { getLessonsByTopicId, lessons, oid } from './curriculum';
import type { Lesson, Topic } from './types';

const COMPLETED_LESSONS_KEY = 'enablecode.completedLessons';

function readCompletedLessonIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(COMPLETED_LESSONS_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

function writeCompletedLessonIds(ids: Set<string>) {
  window.localStorage.setItem(COMPLETED_LESSONS_KEY, JSON.stringify([...ids]));
}

export function getCompletedLessonIds(): string[] {
  return [...readCompletedLessonIds()];
}

export function isLessonCompleted(lessonId: string): boolean {
  return readCompletedLessonIds().has(lessonId);
}

export function markLessonCompleted(lessonId: string) {
  const ids = readCompletedLessonIds();
  ids.add(lessonId);
  writeCompletedLessonIds(ids);
}

export function getTopicLessonIds(topicId: string): string[] {
  return getLessonsByTopicId(topicId).map(lesson => oid(lesson._id));
}

export function isTopicCompleted(topicId: string): boolean {
  const lessonIds = getTopicLessonIds(topicId);
  if (lessonIds.length === 0) return false;
  return lessonIds.every(id => isLessonCompleted(id));
}

export function getTopicProgressPercent(topicId: string): number {
  const lessonIds = getTopicLessonIds(topicId);
  if (lessonIds.length === 0) return 0;
  const completed = lessonIds.filter(id => isLessonCompleted(id)).length;
  return Math.round((completed / lessonIds.length) * 100);
}

export function areTopicPrerequisitesMet(topic: Topic): boolean {
  // Extract prerequisites from either modern array or legacy array properties safely
  const prerequisites = topic.relevantTopicIds || topic.relevant_topic_ids || [];
  if (prerequisites.length === 0) return true;

  return prerequisites.every(prerequisite => isTopicCompleted(oid(prerequisite)));
}

export function isTopicLocked(topic: Topic): boolean {
  return !areTopicPrerequisitesMet(topic);
}

export function isLessonLocked(lesson: Lesson, lessonsInTopic: Lesson[]): boolean {
  const currentId = oid(lesson._id);
  const index = lessonsInTopic.findIndex(item => oid(item._id) === currentId);
  if (index <= 0) return false;

  const previous = lessonsInTopic[index - 1];
  return !isLessonCompleted(oid(previous._id));
}

export function getAllLessonIds(): string[] {
  return lessons.map(lesson => oid(lesson._id));
}
