import type { NewsCategoryConfig } from '../entities';

export interface INewsCategoryRepository {
  getAll(tenantId: string): Promise<NewsCategoryConfig[]>;
  create(tenantId: string, key: string, label: string, createdBy: string): Promise<NewsCategoryConfig>;
  delete(tenantId: string, key: string): Promise<void>;
}
