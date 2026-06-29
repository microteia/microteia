import type { CaseStatusConfig } from '../entities';

export interface ICaseStatusRepository {
  getAll(tenantId: string): Promise<CaseStatusConfig[]>;
  create(tenantId: string, key: string, label: string, color: string, createdBy: string): Promise<CaseStatusConfig>;
  delete(tenantId: string, key: string): Promise<void>;
}
