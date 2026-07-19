import type { CaseCourtConfig } from '../entities';

export interface ICaseCourtRepository {
  getAll(tenantId: string): Promise<CaseCourtConfig[]>;
  subscribe(tenantId: string, onChange: (items: CaseCourtConfig[]) => void): () => void;
  create(tenantId: string, key: string, label: string, createdBy: string): Promise<CaseCourtConfig>;
  delete(tenantId: string, key: string): Promise<void>;
}
