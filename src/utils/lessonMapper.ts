import type { Difficulty, Hint, Lesson, Testcase, Topic } from '../lib/types';

interface ApiResponse {
  topics?: Topic[];
  lessons?: Lesson[];
  lesson?: Lesson;
  data?: unknown;
}

function normalizeDifficulty(value: unknown): Difficulty {
  const difficulty = String(value ?? 'easy');
  if (difficulty === 'beginner' || difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard') {
    return difficulty;
  }
  return 'easy';
}

function normalizeTestcases(raw: unknown): Testcase[] {
  if (!Array.isArray(raw)) return [];

  return raw.map(testcase => {
    const entry = testcase as Record<string, unknown>;
    return {
      description: entry.description != null ? String(entry.description) : undefined,
      stdin: entry.stdin != null ? String(entry.stdin) : entry.input != null ? String(entry.input) : undefined,
      expectedOutput: String(entry.expectedOutput ?? entry.expected_output ?? ''),
    };
  });
}

function normalizeHints(raw: unknown): Hint[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((hint, index) => {
    const entry = hint as Record<string, unknown>;
    return {
      level: Number(entry.level ?? entry.step ?? index + 1),
      text: String(entry.text ?? ''),
      type: String(entry.type ?? 'text'),
    };
  });
}

export function normalizeTopic(raw: Record<string, unknown>): Topic {
  const relevantTopicIds = (raw.relevantTopicIds ?? raw.relevant_topic_ids ?? []) as string[];

  return {
    _id: String(raw._id),
    title: String(raw.title ?? ''),
    description: raw.description != null ? String(raw.description) : null,
    difficulty: normalizeDifficulty(raw.difficulty),
    relevantTopicIds,
    isActive: raw.isActive !== false && raw.is_active !== false,
  };
}

export function normalizeLesson(raw: Record<string, unknown>): Lesson {
  return {
    _id: String(raw._id),
    topicId: String(raw.topicId ?? raw.topic_id ?? ''),
    title: String(raw.title ?? ''),
    description: raw.description != null ? String(raw.description) : null,
    order: Number(raw.order ?? 0),
    difficulty: normalizeDifficulty(raw.difficulty),
    toolboxConfig: (raw.toolboxConfig ?? raw.toolbox_config ?? {}) as Record<string, unknown>,
    initialBlocks: (raw.initialBlocks ?? raw.initial_blocks ?? {}) as Record<string, unknown>,
    allowedBlocks: Array.isArray(raw.allowedBlocks) ? raw.allowedBlocks : [],
    solution: (raw.solution ?? {}) as Record<string, unknown>,
    hint: normalizeHints(raw.hint),
    publicTestcases: normalizeTestcases(raw.publicTestcases ?? raw.public_testcases),
    hiddenTestcases: normalizeTestcases(raw.hiddenTestcases ?? raw.hidden_testcases),
    baseXp: Number(raw.baseXp ?? raw.base_xp ?? 0),
    duration: Number(raw.duration ?? 0),
    isActive: raw.isActive !== false && raw.is_active !== false,
  };
}

export function extractTopics(apiResponse: unknown): Topic[] {
  if (!apiResponse) return [];

  if (Array.isArray(apiResponse)) {
    return apiResponse.map(topic => normalizeTopic(topic as unknown as Record<string, unknown>));
  }

  const res = apiResponse as ApiResponse;
  return Array.isArray(res.topics)
    ? res.topics.map(topic => normalizeTopic(topic as unknown as Record<string, unknown>))
    : [];
}

export function extractLessons(apiResponse: unknown): Lesson[] {
  if (!apiResponse) return [];

  if (Array.isArray(apiResponse)) {
    return apiResponse.map(lesson => normalizeLesson(lesson as unknown as Record<string, unknown>));
  }

  const res = apiResponse as ApiResponse;
  return Array.isArray(res.lessons)
    ? res.lessons.map(lesson => normalizeLesson(lesson as unknown as Record<string, unknown>))
    : [];
}

export function extractSingleLesson(apiResponse: unknown): Lesson | null {
  if (!apiResponse || typeof apiResponse !== 'object') return null;

  const res = apiResponse as ApiResponse;
  const raw = (res.lesson || res.data || apiResponse) as Record<string, unknown>;

  if (!raw || typeof raw !== 'object' || typeof raw._id !== 'string') return null;

  return normalizeLesson(raw);
}
