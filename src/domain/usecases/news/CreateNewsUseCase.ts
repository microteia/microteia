import type { INewsRepository } from '../../repositories/INewsRepository';
import type { News } from '../../entities';

export type CreateNewsUseCase = {
  execute: (userId: string, data: Omit<News, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<News>;
};

export const makeCreateNewsUseCase = (repo: INewsRepository): CreateNewsUseCase => ({
  execute: (userId, data) => repo.createNews(userId, data),
});
