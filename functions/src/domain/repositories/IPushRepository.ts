import type { Push } from '../entities/Push';

export interface IPushRepository {
  create(tenantId: string, push: Omit<Push, 'id' | 'tenantId' | 'createdAt'>): Promise<Push>;
  getByEmailId(tenantId: string, emailId: string): Promise<Push | null>;
}
