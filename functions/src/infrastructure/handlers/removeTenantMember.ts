import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { domainErrorCode } from '../../domain/errors/DomainError';

interface RemoveTenantMemberRequest {
  tenantId?: string;
  userId?: string;
}

export const removeTenantMember = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const { tenantId, userId } = request.data as RemoveTenantMemberRequest;

    if (!tenantId || !userId) {
      throw new HttpsError('invalid-argument', 'Dados incompletos.');
    }

    try {
      const di = getDI();
      const useCase = di.getRemoveTenantMemberUseCase();
      await useCase.execute(tenantId, userId, request.auth.uid);

      return { success: true };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const message = err instanceof Error ? err.message : 'Erro ao remover membro.';

      throw new HttpsError(domainErrorCode(err) ?? 'internal', message);
    }
  },
);
