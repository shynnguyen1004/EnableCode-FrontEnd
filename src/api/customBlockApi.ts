import axiosClient from './axiosClient';
import type { CustomBlock, CustomBlocksListResponse, CustomBlockResponse } from '../lib/types';

export const customBlockApi = {
  // ==========================
  // STUDENT ACTIONS
  // ==========================
  getAllCustomBlocks: (category?: string) =>
    axiosClient.get<unknown, CustomBlocksListResponse>('/custom-blocks', { params: { category } }),

  getCustomBlock: (blockId: string) => axiosClient.get<unknown, CustomBlockResponse>(`/custom-blocks/${blockId}`),

  // ==========================
  // ADMIN ACTIONS
  // ==========================
  createCustomBlock: (data: Partial<CustomBlock>) =>
    axiosClient.post<unknown, CustomBlockResponse>('/custom-blocks/create', data),

  updateCustomBlock: (blockId: string, data: Partial<CustomBlock>) =>
    axiosClient.put<unknown, CustomBlockResponse>(`/custom-blocks/${blockId}`, data),
};
