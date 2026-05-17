import design from "../../topics_lessons_design.json";
import curriculumEn from "../i18n/curriculum.en.json";
import type { Locale } from "../i18n/locale";
import { translate } from "../i18n/messages";

export type Difficulty = "easy" | "medium" | "hard";

export type MongoOid = { $oid: string };

export type Topic = {
  _id: MongoOid;
  title: string;
  description: string;
  difficulty: Difficulty;
  relevant_topic_ids: MongoOid[];
  is_active: boolean;
};

export type Lesson = {
  _id: MongoOid;
  topic_id: MongoOid;
  title: string;
  description: string;
  order: number;
  difficulty: Difficulty;
  is_active: boolean;
};

type CurriculumDesign = {
  topics: Topic[];
  lessons: Lesson[];
};

const curriculum = design as CurriculumDesign;

export const topics = curriculum.topics.filter((topic) => topic.is_active);
export const lessons = curriculum.lessons.filter((lesson) => lesson.is_active);

export function oid(value: MongoOid | string): string {
  return typeof value === "string" ? value : value.$oid;
}

export function getTopicById(topicId: string): Topic | undefined {
  return topics.find((topic) => oid(topic._id) === topicId);
}

export function getLessonsByTopicId(topicId: string): Lesson[] {
  return lessons
    .filter((lesson) => oid(lesson.topic_id) === topicId)
    .sort((a, b) => a.order - b.order);
}

export function getLessonById(lessonId: string): Lesson | undefined {
  return lessons.find((lesson) => oid(lesson._id) === lessonId);
}

export type LocalizedCurriculumText = {
  title: string;
  description: string;
};

type CurriculumEnEntry = {
  title: string;
  description: string;
};

const englishCurriculum = curriculumEn as Record<string, CurriculumEnEntry>;

export function getLocalizedTopic(topic: Topic, locale: Locale): LocalizedCurriculumText {
  if (locale === "vi") {
    return { title: topic.title, description: topic.description };
  }

  const entry = englishCurriculum[oid(topic._id)];
  return entry ?? { title: topic.title, description: topic.description };
}

export function getLocalizedLesson(lesson: Lesson, locale: Locale): LocalizedCurriculumText {
  if (locale === "vi") {
    return { title: lesson.title, description: lesson.description };
  }

  const entry = englishCurriculum[oid(lesson._id)];
  return entry ?? { title: lesson.title, description: lesson.description };
}

export function localizedDifficultyLabel(difficulty: Difficulty, locale: Locale): string {
  return translate(locale, `course.difficulty.${difficulty}`);
}

/** @deprecated Use localizedDifficultyLabel with locale from useI18n */
export function difficultyLabel(difficulty: Difficulty): string {
  return localizedDifficultyLabel(difficulty, "en");
}

export function cardTone(index: number): "green" | "light-green" | "dark" {
  const tones: Array<"green" | "light-green" | "dark"> = ["green", "light-green", "dark"];
  return tones[index % tones.length];
}

export {
  areTopicPrerequisitesMet,
  getTopicProgressPercent,
  isLessonCompleted,
  isLessonLocked,
  isTopicCompleted,
  isTopicLocked,
  markLessonCompleted,
} from "./progress";
