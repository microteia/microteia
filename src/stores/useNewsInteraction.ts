import { createContext, useContext } from 'react';
import type { NewsInteraction } from '../domain/entities';

export interface NewsInteractionContextValue {
  interactions: NewsInteraction[];
  loading: boolean;
  getInteraction: (newsId: string) => NewsInteraction | undefined;
  markAsRead: (newsId: string) => Promise<void>;
  toggleSavedForLater: (newsId: string, currentlySaved: boolean) => Promise<void>;
  unreadCount: number;
}

export const NewsInteractionContext = createContext<NewsInteractionContextValue | null>(null);

export const useNewsInteraction = (): NewsInteractionContextValue => {
  const ctx = useContext(NewsInteractionContext);
  if (!ctx) throw new Error('useNewsInteraction must be used within NewsInteractionStoreProvider');
  return ctx;
};
