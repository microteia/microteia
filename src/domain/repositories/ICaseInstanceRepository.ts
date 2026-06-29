import type { CaseInstanceConfig } from '../entities';

export interface ICaseInstanceRepository {
  getAll(tenantId: string): Promise<CaseInstanceConfig[]>;
  create(tenantId: string, key: string, label: string, color: string | undefined, createdBy: string): Promise<CaseInstanceConfig>;
  delete(tenantId: string, key: string): Promise<void>;
}
