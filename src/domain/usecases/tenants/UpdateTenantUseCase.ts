import type { Tenant } from '../../entities';
import type { ITenantRepository } from '../../repositories/ITenantRepository';

export type UpdateTenantUseCase = {
  execute: (tenantId: string, data: Partial<Omit<Tenant, 'id' | 'ownerId' | 'createdAt'>>) => Promise<void>;
};

export const makeUpdateTenantUseCase = (repo: ITenantRepository): UpdateTenantUseCase => ({
  execute: (tenantId, data) => repo.updateTenant(tenantId, data),
});
