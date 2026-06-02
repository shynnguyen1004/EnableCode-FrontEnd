import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, readStoredLocale, type Locale } from './locale';
import { translate, type TranslationKey } from './messages';

import { getLocalizedLesson, getLocalizedTopic, localizedDifficultyLabel } from '../lib/curriculum';

import type { Difficulty, Lesson, LocalizedCurriculumText, Topic } from '../lib/types';

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
  localizeTopic: (topic: Topic) => LocalizedCurriculumText;
  localizeLesson: (lesson: Lesson) => LocalizedCurriculumText;
  difficultyLabel: (difficulty: Difficulty) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

type I18nProviderProps = {
  children: ReactNode;
};

export function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: key => translate(locale, key),
      localizeTopic: topic => getLocalizedTopic(topic, locale),
      localizeLesson: lesson => getLocalizedLesson(lesson, locale),
      difficultyLabel: difficulty => localizedDifficultyLabel(difficulty, locale),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
/* eslint-disable react-refresh/only-export-components */
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

export { DEFAULT_LOCALE, type Locale };
