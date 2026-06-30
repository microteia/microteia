import type { IGmailAuthService } from '../repositories/IGmailAuthService';
import type { IGmailWatchService } from '../repositories/IGmailWatchService';
import type { ITenantMemberRepository } from '../repositories/ITenantMemberRepository';
import type { GmailTokens, GmailAuthConfig } from '../entities/GmailTokens';

export type ExchangeGmailCodeUseCase = {
  execute: (
    code: string,
    tenantId: string,
    userId: string,
    config: GmailAuthConfig,
    topicName: string,
  ) => Promise<GmailTokens>;
};

export const makeExchangeGmailCodeUseCase = (
  gmailAuthService: IGmailAuthService,
  gmailWatchService: IGmailWatchService,
  tenantMemberRepo: ITenantMemberRepository,
): ExchangeGmailCodeUseCase => ({
  execute: async (
    code: string,
    tenantId: string,
    userId: string,
    config: GmailAuthConfig,
    topicName: string,
  ) => {
    const role = await tenantMemberRepo.getMemberRole(tenantId, userId);
    
    if (role !== 'admin') {
      throw new Error('Apenas administradores podem autorizar contas Gmail.');
    }

    const tokens = await gmailAuthService.exchangeCode(code, config);

    try {
      const watchResult = await gmailWatchService.registerWatch(
        tokens.accessToken,
        topicName,
        config,
      );

      return {
        ...tokens,
        historyId: watchResult.historyId,
        expiration: watchResult.expiration,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido ao registrar watch.';
      throw new Error(`Falha ao configurar integração Gmail completa: ${message}`, { cause: error });
    }
  },
});
