import type { Topic, Lesson, Difficulty } from './types';
import curriculumEn from '../i18n/curriculum.en.json';
import type { Locale } from '../i18n/locale';
import { translate } from '../i18n/messages';

export interface LocalizedCurriculumText {
  title: string;
  description: string | null;
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
  // Normalize 'beginner' to 'easy' if needed by your translation files
  const key = difficulty === 'beginner' ? 'easy' : difficulty;
  return translate(locale, `course.difficulty.${key}`);
}

export function cardTone(index: number): 'green' | 'light-green' | 'dark' {
  const tones: Array<'green' | 'light-green' | 'dark'> = ['green', 'light-green', 'dark'];
  return tones[index % tones.length];
}
