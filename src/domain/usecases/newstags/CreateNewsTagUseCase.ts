import type { INewsTagRepository } from '../../repositories/INewsTagRepository';
import type { NewsTag } from '../../entities';

export type CreateNewsTagUseCase = {
  execute: (userId: string, data: Omit<NewsTag, 'id' | 'userId' | 'createdAt'>) => Promise<NewsTag>;
};

export const makeCreateNewsTagUseCase = (repo: INewsTagRepository): CreateNewsTagUseCase => ({
  execute: (userId, data) => repo.createTag(userId, data),
});
