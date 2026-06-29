import type { CaseActionTypeConfig } from '../entities';

export interface ICaseActionTypeRepository {
  getAll(tenantId: string): Promise<CaseActionTypeConfig[]>;
  create(tenantId: string, key: string, label: string, createdBy: string): Promise<CaseActionTypeConfig>;
  delete(tenantId: string, key: string): Promise<void>;
}
