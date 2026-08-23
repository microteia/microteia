import type { TenantMember } from '../../entities';
import type { ITenantRepository, TenantMemberRoleActor } from '../../repositories/ITenantRepository';

export type { TenantMemberRoleActor };

export type AddTenantMemberUseCase = {
  execute: (tenantId: string, member: Omit<TenantMember, 'addedAt' | 'permissions'>) => Promise<void>;
};

export type UpdateTenantMemberRolesUseCase = {
  execute: (tenantId: string, userId: string, roleIds: string[], actor: TenantMemberRoleActor) => Promise<void>;
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

export const makeUpdateTenantMemberRolesUseCase = (repo: ITenantRepository): UpdateTenantMemberRolesUseCase => ({
  execute: (tenantId, userId, roleIds, actor) => repo.updateMemberRoles(tenantId, userId, roleIds, actor),
});

export const makeRemoveTenantMemberUseCase = (repo: ITenantRepository): RemoveTenantMemberUseCase => ({
  execute: (tenantId, userId) => repo.removeMember(tenantId, userId),
});

export const makeGetTenantMembersUseCase = (repo: ITenantRepository): GetTenantMembersUseCase => ({
  execute: (tenantId) => repo.getMembers(tenantId),
});
