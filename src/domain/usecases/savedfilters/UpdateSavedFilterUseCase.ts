import type { ISavedFilterRepository } from '../../repositories/ISavedFilterRepository';
import type { SavedFilterToken } from '../../entities';

export type UpdateSavedFilterUseCase = {
  execute: (
    id: string,
    data: { name?: string; tokens?: SavedFilterToken[] },
  ) => Promise<void>;
};

export const makeUpdateSavedFilterUseCase = (repo: ISavedFilterRepository): UpdateSavedFilterUseCase => ({
  execute: (id, data) => repo.updateFilter(id, data),
});
