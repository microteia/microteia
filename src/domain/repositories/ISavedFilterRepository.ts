import type { SavedFilter, SavedFilterToken } from '../entities';

export interface ISavedFilterRepository {
  getFilters(userId: string): Promise<SavedFilter[]>;
  createFilter(
    userId: string,
    screenKey: string,
    name: string,
    tokens: SavedFilterToken[],
  ): Promise<SavedFilter>;
  updateFilter(
    id: string,
    data: { name?: string; tokens?: SavedFilterToken[] },
  ): Promise<void>;
  deleteFilter(id: string): Promise<void>;
}
