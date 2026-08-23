import type { ITenantRepository, AddTenantMemberInput } from '../repositories/ITenantRepository';
import type { ITenantMemberRepository } from '../repositories/ITenantMemberRepository';
import type { IUserRepository } from '../repositories/IUserRepository';
import { permissionDenied } from '../errors/DomainError';
import { PERMISSION_MEMBERS_MANAGE, grants } from '../schema/access';

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
  userRepo: IUserRepository,
): AddTenantMemberUseCase => ({
  execute: async (tenantId, member, requesterId) => {
    const granted = await tenantMemberRepo.getMemberPermissions(tenantId, requesterId);
    if (!grants(granted, PERMISSION_MEMBERS_MANAGE)) {
      const globalRole = await userRepo.getUserRole(requesterId);
      if (globalRole !== 'SYSTEM') {
        throw permissionDenied('@core.tenant/member.add.admin-only');
      }
    }

    await tenantRepo.addMemberIfWithinLimit(tenantId, { ...member, addedBy: requesterId });
  },
});
