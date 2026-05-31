// ========================================
// PRIMITIVE & UTILITY TYPES
// ========================================
export type ObjectId = string;

export type Difficulty = 'beginner' | 'easy' | 'medium' | 'hard';

// ========================================
// CORE DATA MODELS
// ========================================

export interface User {
  _id: ObjectId;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  name: string;
  avatar: string | null;
  totalScore: number;
  lessonsCompleted: number;
  streak: number;
  level: number;
  resetPasswordToken: string | null;
  resetPasswordExpires: string | null;
  lastActiveDate: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserStats {
  totalScore: number;
  lessonsCompleted: number;
  streak: number;
  level: number;
}

export interface Topic {
  _id: ObjectId;
  title: string;
  description: string | null;
  difficulty: Difficulty;
  relevantTopicIds: ObjectId[];
  isActive: boolean;
}

export interface Hint {
  level: number;
  text: string;
  type: string;
  [key: string]: unknown;
}

export interface Testcase {
  description?: string;
  stdin?: string;
  args?: string[];
  expectedOutput?: string;
  [key: string]: unknown;
}

export interface Lesson {
  _id: ObjectId;
  topicId: ObjectId;
  title: string;
  description: string | null;
  order: number;
  difficulty: Difficulty;
  problemStatement: string;
  toolboxConfig: Record<string, unknown>;
  initialBlocks: Record<string, unknown>;
  solution: Record<string, unknown>;
  hint: Hint[];
  publicTestcases: Testcase[];
  hiddenTestcases: Testcase[];
  baseXp: number;
  duration: number;
  isActive: boolean;
}

export interface UserProgress {
  _id: ObjectId;
  userId: ObjectId;
  lessonId: ObjectId;
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  attemptsCount: number;
  hintsRevealed: number[];
  hasViewedSolution: boolean;
  workspaceState: Record<string, unknown>;
  time: number;
  points: number;
  submittedAt: string | null;
}

// ========================================
// AI CALIBRATION (Gestures & Face Tracking)
// ========================================

export interface CalibrationBounds {
  leftX?: number;
  rightX?: number;
  topY?: number;
  bottomY?: number;
}

export interface CalibrationPreferences {
  mouthDragThreshold?: number;
  trackingSensitivity?: number;
}

export interface Calibration {
  _id: ObjectId;
  userId: ObjectId;
  bounds?: CalibrationBounds;
  preferences?: CalibrationPreferences;
  createdAt?: string;
  updatedAt?: string;
}

// ========================================
// EXTENSIONS & GAMIFICATION
// ========================================

export interface CustomBlock {
  _id: ObjectId;
  blockType: string;
  definition: Record<string, unknown>;
  generatorCode?: string;
  category?: string;
}

export interface LeaderboardEntry {
  userId: ObjectId;
  name: string;
  avatar: string | null;
  totalScore?: number;
  lessonsCompleted?: number;
}

// ========================================
// API RESPONSES
// ========================================

export interface AuthResponse {
  success: boolean;
  accessToken?: string;
  user?: User;
}

export interface MessageResponse {
  message: string;
}
