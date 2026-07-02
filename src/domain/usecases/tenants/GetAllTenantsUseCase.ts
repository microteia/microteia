import type { Tenant } from '../../entities';
import type { ITenantRepository } from '../../repositories/ITenantRepository';

export type GetAllTenantsUseCase = {
  execute: () => Promise<Tenant[]>;
};

export const makeGetAllTenantsUseCase = (repo: ITenantRepository): GetAllTenantsUseCase => ({
  execute: () => repo.getAllTenants(),
});
