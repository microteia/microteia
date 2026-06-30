import type { Tenant } from '../entities/Tenant';

export interface ITenantRepository {
  getById(tenantId: string): Promise<Tenant | null>;
}
