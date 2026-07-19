import type { CaseInstanceConfig } from '../entities';

export interface ICaseInstanceRepository {
  getAll(tenantId: string): Promise<CaseInstanceConfig[]>;
  subscribe(tenantId: string, onChange: (items: CaseInstanceConfig[]) => void): () => void;
  create(tenantId: string, key: string, label: string, color: string | undefined, createdBy: string): Promise<CaseInstanceConfig>;
  delete(tenantId: string, key: string): Promise<void>;
}
