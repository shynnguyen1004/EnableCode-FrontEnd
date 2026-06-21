// ========================================
// PRIMITIVE & UTILITY TYPES
// ========================================
export type ObjectId = string;

export type Difficulty = 'beginner' | 'easy' | 'medium' | 'hard';

// ========================================
// CORE DATA MODELS
// ========================================

export interface UserProfileResponse {
  _id: ObjectId;
  email: string;
  role: 'student' | 'teacher' | 'admin';
  name: string;
  avatar: string | null;
  totalScore: number;
  lessonsCompleted: number;
  badges: number;
  streak: number;
  level: number;
  lastActiveDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  isCalibrated?: boolean;
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
  visualFeedback?: boolean;
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
  totalScore: number;
  lessonsCompleted: number;
}

// ========================================
// API RESPONSES
// ========================================

export interface AuthResponse {
  success: boolean;
  accessToken?: string;
  user?: UserProfileResponse;
}

export interface MessageResponse {
  message: string;
}

// ========================================
// API REQUESTS (PAYLOADS)
// ========================================

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role?: 'student' | 'teacher' | 'admin';
  avatar?: string | null;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface SubmitLessonRequest {
  workspaceState: Record<string, unknown>;
  pythonCode: string;
  time: number;
}

export interface SaveProgressRequest {
  workspaceState: Record<string, unknown>;
  time: number;
}

export interface UpdateCalibrationRequest {
  bounds?: CalibrationBounds;
  preferences?: CalibrationPreferences;
}

export interface UpdateProfileRequest {
  name?: string;
  avatar?: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Dành cho form tạo bài học của Teacher/Admin
export interface CreateLessonRequest {
  topicId: ObjectId;
  title: string;
  description?: string;
  order?: number;
  difficulty?: Difficulty;
  problemStatement?: string;
  toolboxConfig?: Record<string, unknown>;
  initialBlocks?: Record<string, unknown>;
  solution?: Record<string, unknown>;
  hint?: Hint[];
  publicTestcases?: Testcase[];
  hiddenTestcases?: Testcase[];
  baseXp?: number;
  duration?: number;
  isActive?: boolean;
}

export type UpdateLessonRequest = Partial<CreateLessonRequest>;

// ========================================
// EXTENDED API RESPONSES
// ========================================

export interface SubmitLessonResponse {
  progress: UserProgress;
  passed: boolean;
  points: number;
  output: string;
  testcaseResults: Record<string, unknown>[];
}

export interface RefreshTokenResponse {
  success: boolean;
  accessToken: string;
}

export interface HintResponse {
  hint: Hint;
  index: number;
}

export interface PaginatedLessonsResponse {
  lessons: Lesson[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface PaginatedLeaderboardResponse {
  data: LeaderboardEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

// Chuẩn hóa cấu trúc lỗi để dùng trong axiosClient.ts hoặc try/catch
export interface ErrorDetail {
  field: string;
  issue: string;
}

export interface ErrorResponse {
  success: boolean; // Thường là false
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[];
  };
}

// ========================================
// I18N TYPES
// ========================================
export interface LocalizedCurriculumText {
  title: string;
  description: string | null;
}
