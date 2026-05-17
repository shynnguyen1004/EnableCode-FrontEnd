import { getLessonsByTopicId, lessons, oid, type Lesson, type Topic } from "./curriculum";

const COMPLETED_LESSONS_KEY = "enablecode.completedLessons";

function readCompletedLessonIds(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(COMPLETED_LESSONS_KEY);
    if (!raw) return new Set();

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();

    return new Set(parsed.filter((id): id is string => typeof id === "string"));
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

/** Mark a lesson complete (e.g. after passing workspace tests). */
export function markLessonCompleted(lessonId: string) {
  const ids = readCompletedLessonIds();
  ids.add(lessonId);
  writeCompletedLessonIds(ids);
}

export function getTopicLessonIds(topicId: string): string[] {
  return getLessonsByTopicId(topicId).map((lesson) => oid(lesson._id));
}

/** Topic is complete when every active lesson in it is completed. */
export function isTopicCompleted(topicId: string): boolean {
  const lessonIds = getTopicLessonIds(topicId);
  if (lessonIds.length === 0) return false;

  return lessonIds.every((id) => isLessonCompleted(id));
}

/** 0–100 based on completed lessons in the topic. */
export function getTopicProgressPercent(topicId: string): number {
  const lessonIds = getTopicLessonIds(topicId);
  if (lessonIds.length === 0) return 0;

  const completed = lessonIds.filter((id) => isLessonCompleted(id)).length;
  return Math.round((completed / lessonIds.length) * 100);
}

export function areTopicPrerequisitesMet(topic: Topic): boolean {
  if (topic.relevant_topic_ids.length === 0) {
    return true;
  }

  return topic.relevant_topic_ids.every((prerequisite) => isTopicCompleted(oid(prerequisite)));
}

export function isTopicLocked(topic: Topic): boolean {
  return !areTopicPrerequisitesMet(topic);
}

export function isLessonLocked(lesson: Lesson, lessonsInTopic: Lesson[]): boolean {
  const index = lessonsInTopic.findIndex((item) => oid(item._id) === oid(lesson._id));
  if (index <= 0) return false;

  const previous = lessonsInTopic[index - 1];
  return !isLessonCompleted(oid(previous._id));
}

/** Dev helper: export active lesson ids for quick testing. */
export function getAllLessonIds(): string[] {
  return lessons.map((lesson) => oid(lesson._id));
}
