import type { IAIConnectionRepository } from '../repositories/IAIConnectionRepository';
import type { ITenantMemberRepository } from '../repositories/ITenantMemberRepository';
import type { AICredentials } from '../entities/AICredentials';
import { permissionDenied } from '../errors/DomainError';

export type GetDefaultAICredentialsUseCase = {
  execute: (tenantId: string, userId: string) => Promise<AICredentials>;
};

export const makeGetDefaultAICredentialsUseCase = (
  aiConnectionRepo: IAIConnectionRepository,
  tenantMemberRepo: ITenantMemberRepository,
): GetDefaultAICredentialsUseCase => ({
  execute: async (tenantId: string, userId: string) => {
    const isMember = await tenantMemberRepo.isMember(tenantId, userId);
    if (!isMember) {
      throw permissionDenied('@core.automation/handler.not-member');
    }
    return aiConnectionRepo.getDefaultCredentials(tenantId);
  },
});
