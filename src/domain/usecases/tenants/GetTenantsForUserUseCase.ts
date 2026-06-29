import type { Tenant } from '../../entities';
import type { ITenantRepository } from '../../repositories/ITenantRepository';

export type GetTenantsForUserUseCase = {
  execute: (userId: string) => Promise<Tenant[]>;
};

export const makeGetTenantsForUserUseCase = (repo: ITenantRepository): GetTenantsForUserUseCase => ({
  execute: (userId) => repo.getTenantsForUser(userId),
});
