// src/lib/curriculum.ts
import design from '../mocks/topics_lessons_design.json';
import type { Topic, Lesson, MongoOid, Difficulty, LocalizedCurriculumText } from './types';
import curriculumEn from '../i18n/curriculum.en.json';
import type { Locale } from '../i18n/locale';
import { translate } from '../i18n/messages';

type CurriculumDesign = {
  topics: Topic[];
  lessons: Lesson[];
};

const curriculum = design as CurriculumDesign;

// Safely evaluate activation status across different naming standards
export const topics = curriculum.topics.filter(topic => topic.is_active ?? topic.isActive);
export const lessons = curriculum.lessons.filter(lesson => lesson.is_active ?? lesson.isActive);

export function oid(value: MongoOid | string | undefined): string {
  if (!value) return '';
  return typeof value === 'string' ? value : value.$oid;
}

export function getTopicById(topicId: string): Topic | undefined {
  return topics.find(topic => oid(topic._id) === topicId);
}

export function getLessonsByTopicId(topicId: string): Lesson[] {
  return lessons.filter(lesson => oid(lesson.topic_id || lesson.topicId) === topicId).sort((a, b) => a.order - b.order);
}

export function getLessonById(lessonId: string): Lesson | undefined {
  return lessons.find(lesson => oid(lesson._id) === lessonId);
}

type CurriculumEnEntry = {
  title: string;
  description: string;
};

const englishCurriculum = curriculumEn as Record<string, CurriculumEnEntry>;

export function getLocalizedTopic(topic: Topic, locale: Locale): LocalizedCurriculumText {
  if (locale === 'vi') {
    return { title: topic.title, description: topic.description };
  }
  const entry = englishCurriculum[oid(topic._id)];
  return entry ?? { title: topic.title, description: topic.description };
}

export function getLocalizedLesson(lesson: Lesson, locale: Locale): LocalizedCurriculumText {
  if (locale === 'vi') {
    return { title: lesson.title, description: lesson.description };
  }
  const entry = englishCurriculum[oid(lesson._id)];
  return entry ?? { title: lesson.title, description: lesson.description };
}

export function localizedDifficultyLabel(difficulty: Difficulty, locale: Locale): string {
  // Normalize custom API ranks to existing translation keys if needed
  let key = difficulty;
  if (['SSS', 'SS', 'S', 'A'].includes(difficulty)) key = 'hard';
  if (['B', 'C'].includes(difficulty)) key = 'medium';
  if (['D', 'F', 'beginner'].includes(difficulty)) key = 'easy';

  return translate(locale, `course.difficulty.${key}`);
}

/** @deprecated Use localizedDifficultyLabel with locale from useI18n */
export function difficultyLabel(difficulty: Difficulty): string {
  return localizedDifficultyLabel(difficulty, 'en');
}

export function cardTone(index: number): 'green' | 'light-green' | 'dark' {
  const tones: Array<'green' | 'light-green' | 'dark'> = ['green', 'light-green', 'dark'];
  return tones[index % tones.length];
}
