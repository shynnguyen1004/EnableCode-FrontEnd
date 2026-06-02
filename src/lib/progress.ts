import type { Topic, Lesson } from './types';

export function isLessonCompleted(lessonId: string): boolean {
  try {
    const completed = JSON.parse(localStorage.getItem('enablecode_completed_lessons') || '[]');
    return completed.includes(lessonId);
  } catch {
    return false;
  }
}

export function markLessonCompleted(lessonId: string): void {
  try {
    const completed = JSON.parse(localStorage.getItem('enablecode_completed_lessons') || '[]');
    if (!completed.includes(lessonId)) {
      completed.push(lessonId);
      localStorage.setItem('enablecode_completed_lessons', JSON.stringify(completed));
    }
  } catch (error) {
    console.error('Failed to save progress locally:', error);
  }
}

export function isLessonLocked(lesson: Lesson, lessonsInTopic: Lesson[]): boolean {
  if (lesson.order <= 1) return false;
  const previousLesson = lessonsInTopic.find(l => l.order === lesson.order - 1);
  if (!previousLesson) return false;
  return !isLessonCompleted(previousLesson._id);
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isTopicCompleted(_topicId: string): boolean {
  return false;
}

export function areTopicPrerequisitesMet(topic: Topic): boolean {
  const prerequisites = topic.relevantTopicIds;
  if (!prerequisites || prerequisites.length === 0) return true;
  return prerequisites.every(prerequisiteId => isTopicCompleted(prerequisiteId));
}

export function isTopicLocked(topic: Topic): boolean {
  return !areTopicPrerequisitesMet(topic);
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getTopicProgressPercent(topicId: string): number {
  return 0;
}
