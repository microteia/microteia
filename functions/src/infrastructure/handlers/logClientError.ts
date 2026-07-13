import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';

interface LogClientErrorRequest {
  tenantId?: string;
  title?: string;
  entity?: string;
  entityId?: string;
  entityLink?: string;
  message?: string;
  stack?: string;
}

export const logClientError = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const { tenantId, title, entity, entityId, entityLink, message, stack } = request.data as LogClientErrorRequest;

    if (!tenantId || !title || !entity || !message) {
      throw new HttpsError('invalid-argument', 'Dados da falha incompletos.');
    }

    try {
      const di = getDI();
      const useCase = di.getLogClientErrorUseCase();
      await useCase.execute(
        { tenantId, title, entity, entityId, entityLink, message, stack },
        request.auth.uid,
      );

      return { success: true };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const errorMessage = err instanceof Error ? err.message : 'Erro ao registrar falha.';

      if (errorMessage.includes('não pertence')) {
        throw new HttpsError('permission-denied', errorMessage);
      }

      throw new HttpsError('internal', errorMessage);
    }
  },
);
