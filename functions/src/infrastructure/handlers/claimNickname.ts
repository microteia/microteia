import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { domainErrorCode } from '../../domain/errors/DomainError';

interface ClaimNicknameRequest {
  nickname?: string;
}

export const claimNickname = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }

    const { nickname } = request.data as ClaimNicknameRequest;

    if (!nickname || typeof nickname !== 'string') {
      throw new HttpsError('invalid-argument', 'nickname é obrigatório.');
    }

    try {
      const di = getDI();
      const useCase = di.getClaimNicknameUseCase();
      await useCase.execute(nickname, request.auth.uid);

      return { success: true };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const message = err instanceof Error ? err.message : 'Erro ao reivindicar apelido.';
      
      throw new HttpsError(domainErrorCode(err) ?? 'internal', message);
    }
  },
);
