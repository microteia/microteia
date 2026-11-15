import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';
import { domainErrorCode, DomainError } from '../../domain/errors/DomainError';
import { PublicationConsentRequired } from '../../domain/usecases/PublishExtensionUseCase';

/**
 * Publicar no catálogo (`public_extensions`) — a ÚNICA porta de escrita dele. Ver
 * `PublishExtensionUseCase`: o que vai ao catálogo é a cópia instalada, e só quando ela está completa.
 *
 * A pergunta de permissão é a de sempre (`extensions.manage` no escritório que publica); a de código
 * (só o `SYSTEM` publica código) é do caso de uso, porque depende do pacote que ele lê.
 */
export const publishExtension = onCall({ region: 'southamerica-east1', cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
  const data = (request.data ?? {}) as Record<string, unknown>;
  const tenantId = typeof data.tenantId === 'string' ? data.tenantId : '';
  const pluginId = typeof data.pluginId === 'string' ? data.pluginId : '';
  if (!tenantId || !pluginId) throw new HttpsError('invalid-argument', '@core.marketplace/publish.invalid-request');

  await requirePermission(tenantId, request.auth, 'extensions.manage');
  const di = getDI();
  const userId = request.auth.uid;
  try {
    const [role, actor] = await Promise.all([
      di.getUserRepository().getUserRole(userId),
      di.getUserProfileLookupService().resolveActor(userId),
    ]);
    return await di.getPublishExtensionUseCase().execute({
      tenantId,
      pluginId,
      acceptDependentRanges: data.acceptDependentRanges === true,
      isSystem: role === 'SYSTEM',
      actor: { userId, userName: actor.name, photoURL: actor.photoURL || null },
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    // A lista inteira vai junto: a tela pergunta uma vez, dizendo cada dependente que fica de fora.
    if (error instanceof PublicationConsentRequired) {
      throw new HttpsError('failed-precondition', error.message, { ...error.params, issues: error.issues });
    }
    const code = domainErrorCode(error);
    if (code) throw new HttpsError(code, (error as DomainError).message, (error as DomainError).params);
    logger.error(`[publishExtension] failed: ${error instanceof Error ? error.message : String(error)}`);
    throw new HttpsError('internal', '@core.marketplace/publish.failed');
  }
});
