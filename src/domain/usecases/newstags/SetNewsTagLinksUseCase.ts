import type { INewsTagLinkRepository } from '../../repositories/INewsTagLinkRepository';

export type SetNewsTagLinksUseCase = {
  execute: (userId: string, newsId: string, tagIds: string[]) => Promise<void>;
};

export const makeSetNewsTagLinksUseCase = (repo: INewsTagLinkRepository): SetNewsTagLinksUseCase => ({
  execute: (userId, newsId, tagIds) => repo.setTagsForNews(userId, newsId, tagIds),
});
