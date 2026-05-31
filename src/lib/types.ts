// src/lib/types.ts

export type Difficulty = 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export type Topic = {
  _id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  relevant_topic_ids: string[];
  is_active: boolean;
};

export type Lesson = {
  _id: string;
  topic_id: string;
  title: string;
  description: string;
  order: number;
  difficulty: Difficulty;
  is_active: boolean;
};

export type LocalizedCurriculumText = {
  title: string;
  description: string;
};
