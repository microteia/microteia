import type { ITenantRepository } from '../../repositories/ITenantRepository';

export type UpdateTenantMemberLimitUseCase = {
  execute: (tenantId: string, memberLimit: number | null) => Promise<void>;
};

export const makeUpdateTenantMemberLimitUseCase = (repo: ITenantRepository): UpdateTenantMemberLimitUseCase => ({
  execute: (tenantId, memberLimit) => repo.updateMemberLimit(tenantId, memberLimit),
});
