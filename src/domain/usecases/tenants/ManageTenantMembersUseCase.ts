import type { TenantMember, TenantRole } from '../../entities';
import type { ITenantRepository } from '../../repositories/ITenantRepository';

export type AddTenantMemberUseCase = {
  execute: (tenantId: string, member: Omit<TenantMember, 'addedAt'>) => Promise<void>;
};

export type UpdateTenantMemberRoleUseCase = {
  execute: (tenantId: string, userId: string, role: TenantRole) => Promise<void>;
};

export type RemoveTenantMemberUseCase = {
  execute: (tenantId: string, userId: string) => Promise<void>;
};

export type GetTenantMembersUseCase = {
  execute: (tenantId: string) => Promise<TenantMember[]>;
};

export const makeAddTenantMemberUseCase = (repo: ITenantRepository): AddTenantMemberUseCase => ({
  execute: (tenantId, member) => repo.addMember(tenantId, member),
});

export const makeUpdateTenantMemberRoleUseCase = (repo: ITenantRepository): UpdateTenantMemberRoleUseCase => ({
  execute: (tenantId, userId, role) => repo.updateMemberRole(tenantId, userId, role),
});

export const makeRemoveTenantMemberUseCase = (repo: ITenantRepository): RemoveTenantMemberUseCase => ({
  execute: (tenantId, userId) => repo.removeMember(tenantId, userId),
});

export const makeGetTenantMembersUseCase = (repo: ITenantRepository): GetTenantMembersUseCase => ({
  execute: (tenantId) => repo.getMembers(tenantId),
});
