import type { ITenantRepository } from '../repositories/ITenantRepository';
import type { ITenantMemberRepository } from '../repositories/ITenantMemberRepository';
import type { IUserRepository } from '../repositories/IUserRepository';
import { permissionDenied } from '../errors/DomainError';
import { PERMISSION_MEMBERS_MANAGE, grants } from '../schema/access';

export type RemoveTenantMemberUseCase = {
  execute: (tenantId: string, userId: string, requesterId: string) => Promise<void>;
};

export const makeRemoveTenantMemberUseCase = (
  tenantRepo: ITenantRepository,
  tenantMemberRepo: ITenantMemberRepository,
  userRepo: IUserRepository,
): RemoveTenantMemberUseCase => ({
  execute: async (tenantId, userId, requesterId) => {
    const granted = await tenantMemberRepo.getMemberPermissions(tenantId, requesterId);
    if (!grants(granted, PERMISSION_MEMBERS_MANAGE)) {
      const globalRole = await userRepo.getUserRole(requesterId);
      if (globalRole !== 'SYSTEM') {
        throw permissionDenied('@core.tenant/member.remove.admin-only');
      }
    }

    await tenantRepo.removeMember(tenantId, userId, requesterId);
  },
});
