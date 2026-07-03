import type { ITenantRepository } from '../repositories/ITenantRepository';
import type { ITenantMemberRepository } from '../repositories/ITenantMemberRepository';

export type RemoveTenantMemberUseCase = {
  execute: (tenantId: string, userId: string, requesterId: string) => Promise<void>;
};

export const makeRemoveTenantMemberUseCase = (
  tenantRepo: ITenantRepository,
  tenantMemberRepo: ITenantMemberRepository,
): RemoveTenantMemberUseCase => ({
  execute: async (tenantId, userId, requesterId) => {
    const requesterRole = await tenantMemberRepo.getMemberRole(tenantId, requesterId);
    if (requesterRole !== 'admin') {
      throw new Error('Somente administradores do escritório podem remover membros.');
    }

    await tenantRepo.removeMember(tenantId, userId, requesterId);
  },
});
