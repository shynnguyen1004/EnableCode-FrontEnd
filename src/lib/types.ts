// src/lib/types.ts

export type Difficulty = 'beginner' | 'easy' | 'medium' | 'hard' | 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export type MongoOid = { $oid: string };

export type Topic = {
  _id: string | MongoOid;
  title: string;
  description: string;
  difficulty: Difficulty;
  // Flexible fields supporting both API (camelCase) and Legacy (snake_case)
  relevantTopicIds?: string[];
  relevant_topic_ids?: string[] | MongoOid[];
  isActive?: boolean;
  is_active?: boolean;
};

export type Lesson = {
  _id: string | MongoOid;
  topicId?: string;
  topic_id?: string | MongoOid;
  title: string;
  description: string;
  order: number;
  difficulty: Difficulty;
  isActive?: boolean;
  is_active?: boolean;
};

export type LocalizedCurriculumText = {
  title: string;
  description: string;
};
