import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { domainErrorCode } from '../../domain/errors/DomainError';
import { requireMemberSession } from './shared/requirePermission';

interface RemoveTenantMemberRequest {
  tenantId?: string;
  userId?: string;
}

export const removeTenantMember = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }

    const { tenantId, userId } = request.data as RemoveTenantMemberRequest;

    if (!tenantId || !userId) {
      throw new HttpsError('invalid-argument', 'Dados incompletos.');
    }

    // O caso de uso cobra a permissão; a sessão — o segundo fator que o escritório exigir — é cobrada aqui.
    await requireMemberSession(tenantId, request.auth);

    try {
      const di = getDI();
      const useCase = di.getRemoveTenantMemberUseCase();
      await useCase.execute(tenantId, userId, request.auth.uid);

      return { success: true };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const message = err instanceof Error ? err.message : '@core.tenant/member.remove-failed';

      throw new HttpsError(domainErrorCode(err) ?? 'internal', message);
    }
  },
);
