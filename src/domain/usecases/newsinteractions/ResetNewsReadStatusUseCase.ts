import type { INewsInteractionRepository } from '../../repositories/INewsInteractionRepository';

export type ResetNewsReadStatusUseCase = {
  execute: (newsId: string, excludeUserId?: string) => Promise<void>;
};

export const makeResetNewsReadStatusUseCase = (
  repo: INewsInteractionRepository,
): ResetNewsReadStatusUseCase => ({
  execute: (newsId, excludeUserId) => repo.resetReadStatusForNews(newsId, excludeUserId),
});
