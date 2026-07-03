import type { ITenantRepository, AddTenantMemberInput } from '../repositories/ITenantRepository';
import type { ITenantMemberRepository } from '../repositories/ITenantMemberRepository';

export type AddTenantMemberUseCase = {
  execute: (tenantId: string, member: Omit<AddTenantMemberInput, 'addedBy'>, requesterId: string) => Promise<void>;
};

// O primeiro membro (dono) de um tenant é adicionado pelo bootstrap server-side
// (BootstrapUserUseCase, chamado direto do trigger onUserCreated) — nunca por este
// use case, que serve só ao callable addTenantMember (convite de novos membros por
// um admin já existente).
export const makeAddTenantMemberUseCase = (
  tenantRepo: ITenantRepository,
  tenantMemberRepo: ITenantMemberRepository,
): AddTenantMemberUseCase => ({
  execute: async (tenantId, member, requesterId) => {
    const requesterRole = await tenantMemberRepo.getMemberRole(tenantId, requesterId);
    if (requesterRole !== 'admin') {
      throw new Error('Somente administradores do escritório podem adicionar membros.');
    }

    await tenantRepo.addMemberIfWithinLimit(tenantId, { ...member, addedBy: requesterId });
  },
});
