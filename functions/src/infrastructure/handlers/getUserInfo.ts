import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';

interface GetUserInfoRequest {
  userId?: string;
}

export const getUserInfo = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const { userId } = request.data as GetUserInfoRequest;

    if (!userId) {
      throw new HttpsError('invalid-argument', 'userId é obrigatório.');
    }

    try {
      const di = getDI();
      const useCase = di.getUserInfoUseCase();
      const userInfo = await useCase.execute(userId);

      return {
        displayName: userInfo.displayName,
        photoURL: userInfo.photoURL,
      };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const message = err instanceof Error ? err.message : 'Erro ao buscar informações do usuário.';
      throw new HttpsError('internal', message);
    }
  },
);
