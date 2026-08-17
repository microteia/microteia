import type { ITenantRepository } from '../repositories/ITenantRepository';
import type { ITenantMemberRepository } from '../repositories/ITenantMemberRepository';
import type { IUserRepository } from '../repositories/IUserRepository';
import { permissionDenied } from '../errors/DomainError';

export type RemoveTenantMemberUseCase = {
  execute: (tenantId: string, userId: string, requesterId: string) => Promise<void>;
};

export const makeRemoveTenantMemberUseCase = (
  tenantRepo: ITenantRepository,
  tenantMemberRepo: ITenantMemberRepository,
  userRepo: IUserRepository,
): RemoveTenantMemberUseCase => ({
  execute: async (tenantId, userId, requesterId) => {
    const requesterRole = await tenantMemberRepo.getMemberRole(tenantId, requesterId);
    if (requesterRole !== 'admin') {
      const globalRole = await userRepo.getUserRole(requesterId);
      if (globalRole !== 'SYSTEM' && globalRole !== 'SUPPORT') {
        throw permissionDenied('@core.tenant/member.remove.admin-only');
      }
    }

    await tenantRepo.removeMember(tenantId, userId, requesterId);
  },
});
