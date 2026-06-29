import { createContext, useContext, useCallback } from 'react';
import type { NewsTag } from '../domain/entities';

export interface NewsTagContextValue {
  tags: NewsTag[];
  links: Map<string, string[]>;
  loading: boolean;
  getTagsForNews: (newsId: string) => NewsTag[];
  setTagsForNews: (newsId: string, tagIds: string[]) => Promise<void>;
  createTag: (name: string, color: string) => Promise<NewsTag>;
  updateTag: (id: string, data: { name?: string; color?: string }) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
}

export const NewsTagContext = createContext<NewsTagContextValue | null>(null);

export const useNewsTag = (): NewsTagContextValue => {
  const ctx = useContext(NewsTagContext);
  if (!ctx) throw new Error('useNewsTag must be used within NewsTagStoreProvider');
  return ctx;
};

export { useCallback };
