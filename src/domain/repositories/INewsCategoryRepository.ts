import type { NewsCategoryConfig } from '../entities';

export interface INewsCategoryRepository {
  getAll(): Promise<NewsCategoryConfig[]>;
}
