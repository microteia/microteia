import type { ISavedFilterRepository } from '../../repositories/ISavedFilterRepository';

export type DeleteSavedFilterUseCase = {
  execute: (id: string) => Promise<void>;
};

export const makeDeleteSavedFilterUseCase = (repo: ISavedFilterRepository): DeleteSavedFilterUseCase => ({
  execute: (id) => repo.deleteFilter(id),
});
