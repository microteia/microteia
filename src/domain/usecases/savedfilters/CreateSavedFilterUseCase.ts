import type { ISavedFilterRepository } from '../../repositories/ISavedFilterRepository';
import type { SavedFilter, SavedFilterToken } from '../../entities';

export type CreateSavedFilterUseCase = {
  execute: (
    userId: string,
    screenKey: string,
    name: string,
    tokens: SavedFilterToken[],
  ) => Promise<SavedFilter>;
};

export const makeCreateSavedFilterUseCase = (repo: ISavedFilterRepository): CreateSavedFilterUseCase => ({
  execute: (userId, screenKey, name, tokens) =>
    repo.createFilter(userId, screenKey, name, tokens),
});
