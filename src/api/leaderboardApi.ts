import axiosClient from './axiosClient';
import type { LeaderboardResponse } from '../lib/types';

export const leaderboardApi = {
  getLeaderboard: (page = 1, limit = 10) =>
    axiosClient.get<unknown, LeaderboardResponse>('/leaderboard', { params: { page, limit } }),
};
