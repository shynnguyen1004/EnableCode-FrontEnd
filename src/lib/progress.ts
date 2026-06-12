import type { Topic, Lesson, UserProgress } from './types';

export const isLessonCompleted = (lessonId: string, userProgressList: UserProgress[] = []): boolean => {
  // Guard clause: Return early if inputs are invalid or empty
  if (!lessonId || !userProgressList.length) return false;

  const lessonProgress = userProgressList.find(progress => progress.lessonId === lessonId);
  return lessonProgress?.status === 'completed';
};

/**
 * Determines if a lesson should be locked in the UI.
 * Rule: Lesson 1 is always unlocked. Lesson N is locked if Lesson N-1 is incomplete.
 */
export const isLessonLocked = (
  currentLesson: Lesson,
  topicLessons: Lesson[],
  userProgressList: UserProgress[] = [],
): boolean => {
  // Guard clause: The first lesson is never locked
  if (currentLesson.order <= 1) return false;

  // Find the directly preceding lesson based on the 'order' property
  const previousLesson = topicLessons.find(lesson => lesson.order === currentLesson.order - 1);

  // Guard clause: If the previous lesson doesn't exist in the data, default to unlocked to prevent soft-locks
  if (!previousLesson) return false;

  return !isLessonCompleted(previousLesson._id, userProgressList);
};

/**
 * Calculates the completion percentage of a topic based on its lessons.
 * Useful for rendering progress bars in the UI.
 */
export const calculateTopicCompletionPercentage = (
  topicLessons: Lesson[],
  userProgressList: UserProgress[] = [],
): number => {
  if (!topicLessons.length) return 0;

  const completedLessonsCount = topicLessons.filter(lesson => isLessonCompleted(lesson._id, userProgressList)).length;

  return Math.round((completedLessonsCount / topicLessons.length) * 100);
};

/**
 * Checks if all prerequisite topics for a given topic are met.
 * Pending Backend support: Currently permissive as there is no specific API for topic-level progress.
 */
export const areTopicPrerequisitesMet = (topic: Topic): boolean => {
  const prerequisites = topic.relevantTopicIds;

  // Guard clause: If there are no prerequisites, it's automatically met
  if (!prerequisites || prerequisites.length === 0) return true;

  // TODO (Tech Debt): To implement strict topic locking, we would need to fetch all lessons
  // for each prerequisite topic and check if their completion percentage is 100%.
  // For now, we return true to prevent UI blockage.
  return true;
};

/**
 * Determines if an entire topic is locked based on its prerequisites.
 */
export const isTopicLocked = (topic: Topic): boolean => {
  return !areTopicPrerequisitesMet(topic);
};
