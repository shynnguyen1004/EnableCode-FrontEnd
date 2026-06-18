import axiosClient from './axiosClient';
import type { PaginatedLeaderboardResponse } from '../lib/types';

export const leaderboardApi = {
  getLeaderboard: (page = 1, limit = 10) =>
    axiosClient.get<unknown, PaginatedLeaderboardResponse>('/leaderboard', { params: { page, limit } }),
};
