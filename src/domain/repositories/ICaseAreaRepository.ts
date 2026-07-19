import type { CaseAreaConfig } from '../entities';

export interface ICaseAreaRepository {
  getAll(tenantId: string): Promise<CaseAreaConfig[]>;
  subscribe(tenantId: string, onChange: (items: CaseAreaConfig[]) => void): () => void;
  create(tenantId: string, key: string, label: string, createdBy: string): Promise<CaseAreaConfig>;
  delete(tenantId: string, key: string): Promise<void>;
}
