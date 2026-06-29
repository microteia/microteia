import type { ISavedFilterRepository } from '../../repositories/ISavedFilterRepository';
import type { SavedFilter } from '../../entities';

export type GetSavedFiltersUseCase = {
  execute: (userId: string) => Promise<SavedFilter[]>;
};

export const makeGetSavedFiltersUseCase = (repo: ISavedFilterRepository): GetSavedFiltersUseCase => ({
  execute: (userId) => repo.getFilters(userId),
});
