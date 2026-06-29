import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';

interface CheckNicknameRequest {
  nickname?: string;
}

export const checkNicknameAvailability = onCall(
  { region: 'us-central1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const { nickname } = request.data as CheckNicknameRequest;

    if (!nickname || typeof nickname !== 'string') {
      throw new HttpsError('invalid-argument', 'nickname é obrigatório.');
    }

    try {
      const di = getDI();
      const useCase = di.getCheckNicknameAvailabilityUseCase();
      const result = await useCase.execute(nickname, request.auth.uid);

      return {
        available: result.available,
        reason: result.reason,
      };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const message = err instanceof Error ? err.message : 'Erro ao verificar disponibilidade do apelido.';
      throw new HttpsError('internal', message);
    }
  },
);
