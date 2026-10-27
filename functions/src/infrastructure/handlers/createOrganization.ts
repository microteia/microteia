import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getDI } from '../di/container';
import { domainErrorCode, DomainError } from '../../domain/errors/DomainError';

/**
 * O escritório aberto pelo administrador GLOBAL em nome de alguém (Gestão de Acessos › Escritórios). É o
 * que sobra quando a instalação desliga o autocadastro (`SELF_SERVICE_TENANTS=false`) — e por isso é só
 * do `SYSTEM`: criar escritório numa instalação compartilhada é decisão de quem a mantém.
 */
export const createOrganization = onCall({ region: 'southamerica-east1', cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
  const di = getDI();
  const userId = request.auth.uid;
  if ((await di.getUserRepository().getUserRole(userId)) !== 'SYSTEM') {
    throw new HttpsError('permission-denied', '@core.admin/access.offices.create.system-only');
  }
  const data = (request.data ?? {}) as Record<string, unknown>;
  try {
    const resolved = await di.getUserProfileLookupService().resolveActor(userId);
    return await di.getCreateOrganizationUseCase().execute({
      name: data.name,
      ownerEmail: data.ownerEmail,
      actor: { userId, userName: resolved.name, photoURL: resolved.photoURL },
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    const code = domainErrorCode(error);
    if (code) throw new HttpsError(code, (error as DomainError).message, (error as DomainError).params);
    logger.error(`[createOrganization] failed: ${error instanceof Error ? error.message : String(error)}`);
    throw new HttpsError('internal', '@core.admin/access.offices.create.failed');
  }
});
