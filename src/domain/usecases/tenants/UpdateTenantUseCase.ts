import type { TenantUpdate } from '../../entities';
import type { ITenantRepository } from '../../repositories/ITenantRepository';

export type UpdateTenantUseCase = {
  execute: (tenantId: string, data: TenantUpdate) => Promise<void>;
};

export const makeUpdateTenantUseCase = (repo: ITenantRepository): UpdateTenantUseCase => ({
  execute: (tenantId, data) => repo.updateTenant(tenantId, data),
});
