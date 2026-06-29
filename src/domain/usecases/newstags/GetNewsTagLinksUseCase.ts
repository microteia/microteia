import type { INewsTagLinkRepository } from '../../repositories/INewsTagLinkRepository';
import type { NewsTagLink } from '../../entities';

export type GetNewsTagLinksUseCase = {
  execute: (userId: string) => Promise<NewsTagLink[]>;
};

export const makeGetNewsTagLinksUseCase = (repo: INewsTagLinkRepository): GetNewsTagLinksUseCase => ({
  execute: (userId) => repo.getLinks(userId),
});
