import type { Push } from '../entities/Push';

export interface IPushRepository {
  create(tenantId: string, push: Omit<Push, 'id' | 'tenantId' | 'createdAt'>): Promise<Push>;
  getByEmailId(tenantId: string, emailId: string): Promise<Push | null>;
  update(tenantId: string, pushId: string, updates: Partial<Omit<Push, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>): Promise<void>;
}
