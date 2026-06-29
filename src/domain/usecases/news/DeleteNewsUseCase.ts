import type { INewsRepository } from '../../repositories/INewsRepository';

export type DeleteNewsUseCase = {
  execute: (id: string) => Promise<void>;
};

export const makeDeleteNewsUseCase = (repo: INewsRepository): DeleteNewsUseCase => ({
  execute: (id) => repo.deleteNews(id),
});
