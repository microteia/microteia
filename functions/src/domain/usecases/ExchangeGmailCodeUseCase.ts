import type { IGmailAuthService } from '../repositories/IGmailAuthService';
import type { IGmailWatchService } from '../repositories/IGmailWatchService';
import type { ITenantMemberRepository } from '../repositories/ITenantMemberRepository';
import type { IGmailConnectionRepository } from '../repositories/IGmailConnectionRepository';
import type { GmailConnection } from '../entities/GmailConnection';
import type { GmailAuthConfig } from '../entities/GmailTokens';
import { permissionDenied } from '../errors/DomainError';

/**
 * A autorização INTEIRA acontece aqui: trocar o código, registrar a escuta da caixa e gravar a
 * conexão com o token. O navegador só entrega o código e recebe a conexão de volta — o
 * `refresh_token`, que é a credencial de longo prazo, nunca chega até ele.
 */
export type ExchangeGmailCodeUseCase = {
  execute: (
    code: string,
    tenantId: string,
    userId: string,
    config: GmailAuthConfig,
    topicName: string,
  ) => Promise<GmailConnection>;
};

export const makeExchangeGmailCodeUseCase = (
  gmailAuthService: IGmailAuthService,
  gmailWatchService: IGmailWatchService,
  tenantMemberRepo: ITenantMemberRepository,
  gmailConnectionRepo: IGmailConnectionRepository,
): ExchangeGmailCodeUseCase => ({
  execute: async (
    code: string,
    tenantId: string,
    userId: string,
    config: GmailAuthConfig,
    topicName: string,
  ) => {
    const member = await tenantMemberRepo.getMember(tenantId, userId);

    if (member?.role !== 'admin') {
      throw permissionDenied('Apenas administradores podem autorizar contas Gmail.');
    }

    const tokens = await gmailAuthService.exchangeCode(code, config);

    let historyId: string | undefined;
    let expiration: string | undefined;

    try {
      const watchResult = await gmailWatchService.registerWatch(
        tokens.accessToken,
        topicName,
        config,
      );
      historyId = watchResult.historyId;
      expiration = watchResult.expiration;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido ao registrar watch.';
      throw new Error(`Falha ao configurar integração Gmail completa: ${message}`, { cause: error });
    }

    return gmailConnectionRepo.saveConnection(
      {
        tenantId,
        email: tokens.email,
        scopes: tokens.scopes,
        authorizedBy: userId,
        authorizedByName: member.displayName,
        historyId,
        expiration,
      },
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      },
    );
  },
});
