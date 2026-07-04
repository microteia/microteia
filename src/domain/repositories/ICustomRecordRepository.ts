import type { CustomRecord, DeletionActor } from '../entities';

export interface ICustomRecordRepository {
  getByScreen(tenantId: string, screenKey: string): Promise<CustomRecord[]>;
  getById(tenantId: string, recordId: string): Promise<CustomRecord | null>;
  create(tenantId: string, data: Omit<CustomRecord, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<CustomRecord>;
  update(tenantId: string, recordId: string, data: Partial<Omit<CustomRecord, 'id' | 'tenantId' | 'screenKey' | 'createdAt' | 'createdBy'>>): Promise<void>;
  delete(tenantId: string, recordId: string, actor: DeletionActor): Promise<void>;
  hasRecords(tenantId: string, screenKey: string): Promise<boolean>;
}
