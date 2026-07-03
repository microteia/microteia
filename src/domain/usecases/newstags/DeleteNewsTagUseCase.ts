import type { INewsTagRepository } from '../../repositories/INewsTagRepository';
import type { DeletionActor } from '../../entities';

export type DeleteNewsTagUseCase = {
  execute: (id: string, actor: DeletionActor) => Promise<void>;
};

export const makeDeleteNewsTagUseCase = (repo: INewsTagRepository): DeleteNewsTagUseCase => ({
  execute: (id, actor) => repo.deleteTag(id, actor),
});
