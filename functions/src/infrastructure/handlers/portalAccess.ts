import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';
import { PERMISSION_PORTAL_MANAGE } from '../../domain/schema/access/kernelPermissions';
import { collectionPermissionId } from '../../domain/schema/access/permission';
import { parsePortalSubjectKey } from '../../domain/schema/portal';
import { domainErrorCode } from '../../domain/errors/DomainError';
import { agentCatalog, agentText } from '../agent/agentMessages';
import { agentLocale } from '../agent/agentLocale';

const REGION = 'southamerica-east1';

const authenticated = (auth: { uid: string } | undefined): string => {
  if (!auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
  return auth.uid;
};

const requireString = (value: unknown, message: string): string => {
  if (typeof value !== 'string' || value.trim() === '') throw new HttpsError('invalid-argument', message);
  return value.trim();
};

const asHttpsError = (error: unknown): HttpsError => {
  if (error instanceof HttpsError) return error;
  const message = error instanceof Error ? error.message : '@core.tenant/portal.failed';
  return new HttpsError(domainErrorCode(error) ?? 'internal', message);
};

/**
 * Convida alguém de fora para o portal, vinculado a um registro-sujeito.
 *
 * Cobra DUAS permissões: `portal.manage`, que é o gesto, e a leitura da coleção do sujeito — quem
 * não vê o registro não pode entregá-lo a ninguém.
 */
export const invitePortalUser = onCall({ region: REGION, cors: true }, async (request) => {
  const userId = authenticated(request.auth);
  const data = (request.data ?? {}) as Record<string, unknown>;
  const tenantId = requireString(data.tenantId, '@core.automation/handler.tenant.missing');
  const email = requireString(data.email, '@core.tenant/portal.email.invalid');
  const subjectKey = requireString(data.subjectKey, '@core.tenant/portal.subject.invalid');
  const subject = parsePortalSubjectKey(subjectKey);
  if (!subject) throw new HttpsError('invalid-argument', '@core.tenant/portal.subject.invalid');

  await requirePermission(tenantId, userId, PERMISSION_PORTAL_MANAGE);
  await requirePermission(tenantId, userId, collectionPermissionId(subject.collection, 'read'));

  try {
    const di = getDI();
    const tenant = await di.getTenantRepository().getById(tenantId);
    if (!tenant) throw new HttpsError('not-found', '@core.workspace/tenant.none-found');
    return await di.getInvitePortalUserUseCase().execute({
      tenantId,
      tenantName: tenant.name,
      email,
      subjectKey,
      invitedBy: userId,
    });
  } catch (error) {
    throw asHttpsError(error);
  }
});

/** Revoga um vínculo, ou o convite inteiro quando `subjectKey` não vem. */
export const revokePortalUser = onCall({ region: REGION, cors: true }, async (request) => {
  const userId = authenticated(request.auth);
  const data = (request.data ?? {}) as Record<string, unknown>;
  const tenantId = requireString(data.tenantId, '@core.automation/handler.tenant.missing');
  const portalUserId = requireString(data.userId, '@core.tenant/portal.user.required');
  const subjectKey = typeof data.subjectKey === 'string' && data.subjectKey !== '' ? data.subjectKey : null;

  await requirePermission(tenantId, userId, PERMISSION_PORTAL_MANAGE);
  try {
    await getDI().getRevokePortalUserUseCase().execute(tenantId, portalUserId, subjectKey);
    return { revoked: true };
  } catch (error) {
    throw asHttpsError(error);
  }
});

/**
 * O que a casca do portal precisa para desenhar: o nome e a marca do escritório e as telas expostas,
 * já no idioma de quem entrou. Quem não é convidado daquele escritório não recebe nada.
 */
export const getPortalContext = onCall({ region: REGION, cors: true }, async (request) => {
  const userId = authenticated(request.auth);
  const tenantId = requireString((request.data as Record<string, unknown> | undefined)?.tenantId, '@core.automation/handler.tenant.missing');
  try {
    const di = getDI();
    const tenant = await di.getTenantRepository().getById(tenantId);
    if (!tenant) throw new HttpsError('permission-denied', '@core.tenant/portal.not-invited');
    const catalog = agentCatalog(
      await di.getInstalledExtensionCache().messageBundles(tenantId),
      await agentLocale(tenantId, userId),
    );
    return await di.getPortalContextUseCase().execute({
      tenantId,
      userId,
      tenant: { name: tenant.name, logoURL: tenant.logoURL ?? null },
      resolve: (value) => agentText(catalog, value).text,
    });
  } catch (error) {
    throw asHttpsError(error);
  }
});

/** A URL de um documento compartilhado, só para quem o portal deixa ver. */
export const getPortalDocumentUrl = onCall({ region: REGION, cors: true }, async (request) => {
  const userId = authenticated(request.auth);
  const data = (request.data ?? {}) as Record<string, unknown>;
  const tenantId = requireString(data.tenantId, '@core.automation/handler.tenant.missing');
  const projectionId = requireString(data.projectionId, '@core.tenant/portal.document.unavailable');
  const documentId = requireString(data.documentId, '@core.tenant/portal.document.unavailable');
  try {
    const url = await getDI().getPortalDocumentUrlUseCase().execute({ tenantId, userId, projectionId, documentId });
    return { url };
  } catch (error) {
    throw asHttpsError(error);
  }
});
