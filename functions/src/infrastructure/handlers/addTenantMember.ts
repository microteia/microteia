import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { domainErrorCode } from '../../domain/errors/DomainError';

interface AddTenantMemberRequest {
  tenantId?: string;
  userId?: string;
  role?: string;
  displayName?: string;
  email?: string;
  photoURL?: string | null;
}

export const addTenantMember = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }

    const { tenantId, userId, role, displayName, email, photoURL } = request.data as AddTenantMemberRequest;

    if (!tenantId || !userId || !role || !displayName || !email) {
      throw new HttpsError('invalid-argument', 'Dados do membro incompletos.');
    }

    try {
      const di = getDI();
      const useCase = di.getAddTenantMemberUseCase();
      await useCase.execute(
        tenantId,
        { userId, role, displayName, email, photoURL: photoURL ?? null },
        request.auth.uid,
      );

      return { success: true };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const message = err instanceof Error ? err.message : 'Erro ao adicionar membro.';

      if (message === 'MEMBER_LIMIT_REACHED') {
        throw new HttpsError('resource-exhausted', 'Limite de membros do escritório atingido.');
      }
      throw new HttpsError(domainErrorCode(err) ?? 'internal', message);
    }
  },
);
