import type { IGmailAuthService } from '../repositories/IGmailAuthService';
import type { ITenantMemberRepository } from '../repositories/ITenantMemberRepository';
import type { GmailTokens, GmailAuthConfig } from '../entities/GmailTokens';

export type ExchangeGmailCodeUseCase = {
  execute: (code: string, tenantId: string, userId: string, config: GmailAuthConfig) => Promise<GmailTokens>;
};

export const makeExchangeGmailCodeUseCase = (
  gmailAuthService: IGmailAuthService,
  tenantMemberRepo: ITenantMemberRepository,
): ExchangeGmailCodeUseCase => ({
  execute: async (code: string, tenantId: string, userId: string, config: GmailAuthConfig) => {
    const role = await tenantMemberRepo.getMemberRole(tenantId, userId);
    
    if (role !== 'admin') {
      throw new Error('Apenas administradores podem autorizar contas Gmail.');
    }

    return gmailAuthService.exchangeCode(code, config);
  },
});
