import type { Tenant } from '../../entities';
import type { ITenantRepository } from '../../repositories/ITenantRepository';

export type CreateTenantUseCase = {
  execute: (data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Tenant>;
};

export const makeCreateTenantUseCase = (repo: ITenantRepository): CreateTenantUseCase => ({
  execute: (data) => repo.createTenant(data),
});
