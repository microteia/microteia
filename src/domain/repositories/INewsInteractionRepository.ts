import type { NewsInteraction } from '../entities';

export interface INewsInteractionRepository {
  getInteractionsForUser(userId: string): Promise<NewsInteraction[]>;
  upsertInteraction(
    userId: string,
    newsId: string,
    data: Partial<Pick<NewsInteraction, 'isRead' | 'savedForLater' | 'readAt' | 'savedAt'>>,
  ): Promise<NewsInteraction>;
}
