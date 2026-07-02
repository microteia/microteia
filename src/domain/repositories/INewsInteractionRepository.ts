import type { NewsInteraction } from '../entities';

export interface INewsInteractionRepository {
  upsertInteraction(
    userId: string,
    newsId: string,
    data: Partial<Pick<NewsInteraction, 'isRead' | 'savedForLater' | 'readAt' | 'savedAt'>>,
  ): Promise<NewsInteraction>;
  resetReadStatusForNews(newsId: string, excludeUserId?: string): Promise<void>;
  subscribeToInteractionsForUser(userId: string, onUpdate: (interactions: NewsInteraction[]) => void): () => void;
}
