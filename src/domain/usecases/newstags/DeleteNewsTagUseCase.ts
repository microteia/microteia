import type { INewsTagRepository } from '../../repositories/INewsTagRepository';

export type DeleteNewsTagUseCase = {
  execute: (id: string) => Promise<void>;
};

export const makeDeleteNewsTagUseCase = (repo: INewsTagRepository): DeleteNewsTagUseCase => ({
  execute: (id) => repo.deleteTag(id),
});
