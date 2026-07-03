import type { INewsRepository } from '../../repositories/INewsRepository';
import type { DeletionActor } from '../../entities';

export type DeleteNewsUseCase = {
  execute: (id: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteNewsUseCase = (repo: INewsRepository): DeleteNewsUseCase => ({
  execute: (id, actor) => repo.deleteNews(id, actor),
});
