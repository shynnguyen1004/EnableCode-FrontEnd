import axiosClient from './axiosClient';
import type { CustomBlock } from '../lib/types';

export const customBlockApi = {
  getAllCustomBlocks: (category?: string) =>
    axiosClient.get<unknown, CustomBlock[]>('/custom-blocks', { params: { category } }),

  getCustomBlock: (blockId: string) => axiosClient.get<unknown, CustomBlock>(`/custom-blocks/${blockId}`),
};
