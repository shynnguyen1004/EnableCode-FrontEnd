export type Difficulty = 'easy' | 'medium' | 'hard';

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

export type LocalizedCurriculumText = {
  title: string;
  description: string;
};
