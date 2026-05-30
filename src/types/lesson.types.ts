import type { Difficulty } from '../lib/types';

export type ApiDifficulty = 'beginner' | 'easy' | 'medium' | 'hard';

export interface ApiTopic {
  _id: string;
  title: string;
  description: string;
  difficulty?: ApiDifficulty;
  relevantTopicIds?: string[];
  relevant_topic_ids?: string[];
  isActive?: boolean;
  is_active?: boolean;
}

export interface ApiLesson {
  _id: string;
  topicId?: string;
  topic_id?: string;
  title: string;
  description: string;
  order: number;
  difficulty?: ApiDifficulty;
  isActive?: boolean;
  is_active?: boolean;
}

export interface FrontendTopic extends Omit<
  ApiTopic,
  'difficulty' | 'relevantTopicIds' | 'isActive' | 'relevant_topic_ids' | 'is_active'
> {
  difficulty: Difficulty;
  relevant_topic_ids: string[];
  is_active: boolean;
}

export interface FrontendLesson extends Omit<
  ApiLesson,
  'difficulty' | 'topicId' | 'isActive' | 'topic_id' | 'is_active'
> {
  topic_id: string;
  difficulty: Difficulty;
  is_active: boolean;
}
