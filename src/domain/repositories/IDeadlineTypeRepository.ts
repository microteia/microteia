import type { DeadlineTypeConfig } from '../entities';

export interface IDeadlineTypeRepository {
  getAll(tenantId: string): Promise<DeadlineTypeConfig[]>;
  create(tenantId: string, key: string, label: string, createdBy: string): Promise<DeadlineTypeConfig>;
  delete(tenantId: string, key: string): Promise<void>;
}
