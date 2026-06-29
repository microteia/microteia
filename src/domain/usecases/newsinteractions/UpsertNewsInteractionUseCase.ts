import type { INewsInteractionRepository } from '../../repositories/INewsInteractionRepository';
import type { NewsInteraction } from '../../entities';

export type UpsertNewsInteractionUseCase = {
  execute: (
    userId: string,
    newsId: string,
    data: Partial<Pick<NewsInteraction, 'isRead' | 'savedForLater' | 'readAt' | 'savedAt'>>,
  ) => Promise<NewsInteraction>;
};

export const makeUpsertNewsInteractionUseCase = (repo: INewsInteractionRepository): UpsertNewsInteractionUseCase => ({
  execute: (userId, newsId, data) => repo.upsertInteraction(userId, newsId, data),
});
