import type { INewsTagRepository } from '../../repositories/INewsTagRepository';
import type { NewsTag } from '../../entities';

export type GetNewsTagsUseCase = {
  execute: (userId: string) => Promise<NewsTag[]>;
};

export const makeGetNewsTagsUseCase = (repo: INewsTagRepository): GetNewsTagsUseCase => ({
  execute: (userId) => repo.getTags(userId),
});
