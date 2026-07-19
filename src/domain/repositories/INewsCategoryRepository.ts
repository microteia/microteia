import type { NewsCategoryConfig } from '../entities';

export interface INewsCategoryRepository {
  getAll(tenantId: string): Promise<NewsCategoryConfig[]>;
  subscribe(tenantId: string, onChange: (items: NewsCategoryConfig[]) => void): () => void;
  create(tenantId: string, key: string, label: string, createdBy: string): Promise<NewsCategoryConfig>;
  delete(tenantId: string, key: string): Promise<void>;
}
