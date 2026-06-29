import type { INewsRepository } from '../../repositories/INewsRepository';
import type { News } from '../../entities';

export type GetNewsUseCase = {
  execute: (userId: string, userRole: string, tenantId: string | null) => Promise<News[]>;
};

export const makeGetNewsUseCase = (repo: INewsRepository): GetNewsUseCase => ({
  execute: (userId, userRole, tenantId) => repo.getNews(userId, userRole, tenantId),
});
