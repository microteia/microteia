import { createContext, useContext } from 'react';
import type { News } from '../domain/entities';

export interface NewsContextValue {
  news: News[];
  loading: boolean;
  loadError: string;
  commentCounts: Record<string, number>;
  refresh: () => Promise<void>;
  createNews: (data: Omit<News, 'id' | 'userId' | 'createdBy' | 'createdAt' | 'updatedAt'>) => Promise<News>;
  updateNews: (id: string, data: Partial<Omit<News, 'id' | 'userId' | 'createdAt'>>) => Promise<void>;
  deleteNews: (id: string) => Promise<void>;
  toggleLike: (id: string, userId: string, hasLiked: boolean) => Promise<void>;
}

export const NewsContext = createContext<NewsContextValue | null>(null);

export const useNews = (): NewsContextValue => {
  const ctx = useContext(NewsContext);
  if (!ctx) throw new Error('useNews must be used within NewsStoreProvider');
  return ctx;
};
