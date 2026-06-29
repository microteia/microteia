import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';

interface ClaimNicknameRequest {
  nickname?: string;
}

export const claimNickname = onCall(
  { region: 'us-central1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
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
      
      if (message.includes('já possui um apelido')) {
        throw new HttpsError('already-exists', message);
      }
      if (message.includes('já está em uso')) {
        throw new HttpsError('already-exists', message);
      }
      if (message.includes('inválido')) {
        throw new HttpsError('invalid-argument', message);
      }
      if (message.includes('não é permitido')) {
        throw new HttpsError('invalid-argument', message);
      }
      
      throw new HttpsError('internal', message);
    }
  },
);
