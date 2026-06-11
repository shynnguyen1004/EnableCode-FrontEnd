import design from '../mocks/topics_lessons_design.json';
import type { Topic, Lesson, Difficulty } from './types';
import curriculumEn from '../i18n/curriculum.en.json';
import type { Locale } from '../i18n/locale';
import { translate } from '../i18n/messages';

export interface LocalizedCurriculumText {
  title: string;
  description: string | null;
}

type CurriculumDesign = {
  topics: Topic[];
  lessons: Lesson[];
};

const curriculum = design as unknown as CurriculumDesign;

export const topics = curriculum.topics.filter(topic => topic.isActive);
export const lessons = curriculum.lessons.filter(lesson => lesson.isActive);

export function getTopicById(topicId: string): Topic | undefined {
  return topics.find(topic => topic._id === topicId);
}

function getLessonTopicId(lesson: Lesson & { topic_id?: string }): string {
  return lesson.topicId ?? lesson.topic_id ?? '';
}

export function getLessonsByTopicId(topicId: string): Lesson[] {
  return lessons.filter(lesson => getLessonTopicId(lesson) === topicId).sort((a, b) => a.order - b.order);
}

export function getLessonById(lessonId: string): Lesson | undefined {
  return lessons.find(lesson => lesson._id === lessonId);
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
  const entry = englishCurriculum[topic._id];
  return entry ?? { title: topic.title, description: topic.description };
}

export function getLocalizedLesson(lesson: Lesson, locale: Locale): LocalizedCurriculumText {
  if (locale === 'vi') {
    return { title: lesson.title, description: lesson.description };
  }
  const entry = englishCurriculum[lesson._id];
  return entry ?? { title: lesson.title, description: lesson.description };
}

export function localizedDifficultyLabel(difficulty: Difficulty, locale: Locale): string {
  const key = difficulty === 'beginner' ? 'easy' : difficulty;
  return translate(locale, `course.difficulty.${key}`);
}

export function cardTone(index: number): 'green' | 'light-green' | 'dark' {
  const tones: Array<'green' | 'light-green' | 'dark'> = ['green', 'light-green', 'dark'];
  return tones[index % tones.length];
}
