// src/types/lesson.types.ts

export interface Lesson {
  id: string;
  title: string;
  topicId: string;
  content: string;
  isCompleted: boolean;
}

export interface Topic {
  id: string;
  name: string;
  lessons: Lesson[];
}

export interface UserProgress {
  lessonId: string;
  status: 'locked' | 'available' | 'completed';
}
