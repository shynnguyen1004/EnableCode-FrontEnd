import axiosClient from './axiosClient';
import type { UserProgress } from '../lib/types';

function normalizeUserProgress(raw: Record<string, unknown>): UserProgress {
  return {
    _id: String(raw._id ?? ''),
    userId: String(raw.userId ?? ''),
    lessonId: String(raw.lessonId ?? ''),
    status: (raw.status as UserProgress['status']) ?? 'not_started',
    attemptsCount: Number(raw.attemptsCount ?? 0),
    hintsRevealed: Array.isArray(raw.hintsRevealed) ? raw.hintsRevealed : [],
    hasViewedSolution: Boolean(raw.hasViewedSolution),
    workspaceState: (raw.workspaceState as Record<string, unknown>) ?? {},
    time: Number(raw.time ?? 0),
    points: Number(raw.points ?? 0),
    submittedAt: raw.submittedAt != null ? String(raw.submittedAt) : null,
  };
}

function extractProgressList(response: unknown): UserProgress[] {
  if (Array.isArray(response)) {
    return response.map(item => normalizeUserProgress(item as Record<string, unknown>));
  }

  if (response && typeof response === 'object' && Array.isArray((response as { progress?: unknown[] }).progress)) {
    return (response as { progress: Record<string, unknown>[] }).progress.map(normalizeUserProgress);
  }

  return [];
}

function extractProgressDetail(response: unknown): UserProgress | null {
  if (!response || typeof response !== 'object') return null;

  const wrapped = response as { progress?: Record<string, unknown> };
  const raw = wrapped.progress ?? (response as Record<string, unknown>);

  if (!raw.lessonId && raw.status == null) return null;

  return normalizeUserProgress(raw);
}

export const progressApi = {
  getAllUserProgress: async (): Promise<UserProgress[]> => {
    const response = await axiosClient.get<unknown>('/progress');
    return extractProgressList(response);
  },

  getUserLessonProgress: async (lessonId: string): Promise<UserProgress | null> => {
    try {
      const response = await axiosClient.get<unknown>(`/progress/${lessonId}`);
      return extractProgressDetail(response);
    } catch {
      return null;
    }
  },
};
