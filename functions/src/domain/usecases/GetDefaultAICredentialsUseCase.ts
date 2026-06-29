import type { IAIConnectionRepository } from '../repositories/IAIConnectionRepository';
import type { ITenantMemberRepository } from '../repositories/ITenantMemberRepository';
import type { AICredentials } from '../entities/AICredentials';

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
      throw new Error('Você não é membro deste escritório.');
    }
    return aiConnectionRepo.getDefaultCredentials(tenantId);
  },
});
