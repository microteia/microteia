import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';

/** A referência que o caso de uso lança quando o usuário não é do escritório. */
const NOT_A_MEMBER_REF = '@core.workspace/user.not-a-member';

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
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
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
      const errorMessage = err instanceof Error
        ? err.message
        : '@core.automation/handler.log-error.failed';

      // Reconhece o erro pela CHAVE que o caso de uso lança, e não pela frase: a frase muda de
      // idioma, a chave não.
      if (errorMessage === NOT_A_MEMBER_REF) {
        throw new HttpsError('permission-denied', errorMessage);
      }

      throw new HttpsError('internal', errorMessage);
    }
  },
);
