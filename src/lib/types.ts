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
  toolboxConfig: Record<string, unknown>;
  initialBlocks: Record<string, unknown>;
  allowedBlocks: string[];
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
  center: { x: number; y: number };
  right: { x: number; y: number };
  top: { x: number; y: number };
  bottom: { x: number; y: number };
  left: { x: number; y: number };
}

export interface CalibrationPreferences {
  speed: number;
  mouthDragThreshold: number;
}

export interface Calibration {
  _id: ObjectId;
  userId: ObjectId;
  bounds: CalibrationBounds;
  preferences: CalibrationPreferences;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateCalibrationRequest {
  bounds?: CalibrationBounds;
  preferences?: CalibrationPreferences;
}

interface FaceLandmark {
  x: number;
  y: number;
  z?: number;
}

export interface FaceMeshResults {
  image: CanvasImageSource;
  multiFaceLandmarks?: FaceLandmark[][];
}

export interface FaceMeshType {
  close: () => void;
  send: (config: { image: HTMLVideoElement }) => Promise<void>;
  setOptions: (options: Record<string, unknown>) => void;
  onResults: (callback: (results: FaceMeshResults) => void) => void;
}

export interface CameraType {
  start: () => Promise<void>;
  stop: () => void;
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
  rank: number;
  _id: ObjectId;
  name: string;
  avatar: string | null;
  totalScore: number;
  lessonsCompleted: number;
  streak: number;
  level: number;
}

// ========================================
// API RESPONSES
// ========================================

export interface AuthResponse {
  success: boolean;
  accessToken?: string;
  user?: UserProfileResponse;
}

export interface UserProfileApiResponse {
  success: boolean;
  user: UserProfileResponse;
  message?: string;
}

export interface UserStatsApiResponse {
  success: boolean;
  stats: UserStats;
}

export interface CalibrationApiResponse {
  success: boolean;
  calibration: Calibration;
  message?: string;
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
  password: string;
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

export interface RunLessonResponse {
  passed: boolean;
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

export interface LeaderboardResponse {
  success: boolean;
  leaderboard: LeaderboardEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
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

export interface CustomBlockDTO {
  blockType: string;
  definition: Record<string, unknown>;
  generatorCode: string;
}

export interface LessonDetailResponse {
  success: boolean;
  lesson: Lesson;
  requiredBlocks: CustomBlockDTO[];
}

export interface TopicsListResponse {
  success: boolean;
  topics: Topic[];
}

export interface TopicLessonsResponse {
  success: boolean;
  lessons: Lesson[];
}

export interface UserProgressResponse {
  success: boolean;
  progress: UserProgress;
}

export interface SaveProgressResponse {
  success: boolean;
  message: string;
  progress: UserProgress;
}

export interface CustomBlocksListResponse {
  success: boolean;
  blocks: CustomBlock[];
}

export interface CustomBlockResponse {
  success: boolean;
  block: CustomBlock;
}
