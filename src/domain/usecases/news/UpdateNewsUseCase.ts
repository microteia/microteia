import type { INewsRepository } from '../../repositories/INewsRepository';
import type { News } from '../../entities';

export type UpdateNewsUseCase = {
  execute: (id: string, data: Partial<Omit<News, 'id' | 'userId' | 'createdAt'>>) => Promise<void>;
};

export const makeUpdateNewsUseCase = (repo: INewsRepository): UpdateNewsUseCase => ({
  execute: (id, data) => repo.updateNews(id, data),
});
