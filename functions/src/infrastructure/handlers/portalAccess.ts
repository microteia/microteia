import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';
import { PERMISSION_PORTAL_MANAGE } from '../../domain/schema/access/kernelPermissions';
import { collectionPermissionId } from '../../domain/schema/access/permission';
import { parsePortalSubjectKey } from '../../domain/schema/portal';
import { domainErrorCode } from '../../domain/errors/DomainError';
import { PortalSubmissionInvalid } from '../../domain/usecases/PortalAccessUseCases';
import { agentCatalog, agentText } from '../agent/agentMessages';
import { documentTypeOptions } from '../agent/agentDocuments';
import { identifyActor } from '../workflow/identifyActor';
import { configuredLocale } from '../../domain/services/tenantSettings';
import { DEFAULT_LOCALE } from '../../domain/schema/i18n/localeNegotiation';

const REGION = 'southamerica-east1';

const authenticated = (auth: { uid: string } | undefined): string => {
  if (!auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
  return auth.uid;
};

const requireString = (value: unknown, message: string): string => {
  if (typeof value !== 'string' || value.trim() === '') throw new HttpsError('invalid-argument', message);
  return value.trim();
};

/**
 * A recusa prevista (HttpsError, DomainError) volta como está. A IMPREVISTA vai para o log com a pilha
 * e o gesto que a causou: sem isto o log da function registrava só uma linha de erro em branco, e o
 * convidado via "você não tem acesso" sem que ninguém conseguisse dizer por quê.
 */
const asHttpsError = (error: unknown, operation: string): HttpsError => {
  if (error instanceof HttpsError) return error;
  const code = domainErrorCode(error);
  if (!code) {
    // Pelo `logger`, e não `console.error`: a entrada estruturada leva a mensagem no campo que o
    // `firebase functions:log` exibe — o erro antes saía como uma linha em branco.
    logger.error(`[portal] ${operation} falhou: ${error instanceof Error ? error.message : String(error)}`, {
      operation,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
  const message = error instanceof Error ? error.message : '@core.tenant/portal.failed';
  return new HttpsError(code ?? 'internal', message);
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
      ...(typeof data.locale === 'string' && data.locale ? { locale: data.locale } : {}),
    });
  } catch (error) {
    throw asHttpsError(error, 'invitePortalUser');
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
    throw asHttpsError(error, 'revokePortalUser');
  }
});

/**
 * O que a casca do portal precisa para desenhar: o nome e a marca do escritório e as telas expostas,
 * já no idioma de quem entrou. Quem não é convidado daquele escritório não recebe nada.
 */
export const getPortalContext = onCall({ region: REGION, cors: true }, async (request) => {
  const userId = authenticated(request.auth);
  const data = (request.data ?? {}) as Record<string, unknown>;
  const tenantId = requireString(data.tenantId, '@core.automation/handler.tenant.missing');
  // O idioma do navegador do convidado: vale quando nem ele nem o escritório escolheram um. Sem isso o
  // padrão do produto (`en`) passava por cima do navegador, e o portal de um escritório brasileiro
  // sem a configuração gravada abria em inglês.
  const browserLocale = typeof data.locale === 'string' ? data.locale : '';
  try {
    const di = getDI();
    const tenant = await di.getTenantRepository().getById(tenantId);
    if (!tenant) throw new HttpsError('permission-denied', '@core.tenant/portal.not-invited');
    const settings = di.getTenantSettingsRepository();
    const [own, office] = await Promise.all([settings.getUserValues(tenantId, userId), settings.getTenantValues(tenantId)]);
    const guest = await di.getPortalRepository().getPortalUser(tenantId, userId);
    // Escolhido pelo convidado ou pelo escritório; senão, o de quem convidou — o escritório que usa o
    // produto em português pela preferência pessoal de quem administra não tem padrão gravado, e sem
    // isto o convidado caía no navegador dele.
    const configured = configuredLocale(own, office) ?? guest?.locale ?? null;
    const catalog = agentCatalog(
      await di.getInstalledExtensionCache().messageBundles(tenantId),
      configured ?? (browserLocale || DEFAULT_LOCALE),
    );
    return await di.getPortalContextUseCase().execute({
      tenantId,
      userId,
      tenant: { name: tenant.name, logoURL: tenant.logoURL ?? null },
      locale: configured ?? '',
      resolve: (value) => agentText(catalog, value).text,
      extensionViews: await di.getInstalledExtensionCache().portalViews(tenantId),
      documentTypes: await documentTypeOptions(tenantId, catalog),
    });
  } catch (error) {
    throw asHttpsError(error, 'getPortalContext');
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
    throw asHttpsError(error, 'getPortalDocumentUrl');
  }
});

/**
 * O convidado cria um registro. A recusa da VALIDAÇÃO volta já traduzida, e no idioma do convidado:
 * as frases do motor de gravação são do núcleo, e o pacote de idioma do escritório não chega ao
 * portal — sem isto, o convidado de um escritório brasileiro leria o motivo em inglês.
 */
export const submitPortalRecord = onCall({ region: REGION, cors: true }, async (request) => {
  const userId = authenticated(request.auth);
  const data = (request.data ?? {}) as Record<string, unknown>;
  const tenantId = requireString(data.tenantId, '@core.automation/handler.tenant.missing');
  const collection = requireString(data.collection, '@core.tenant/portal.create.denied');
  const linkRecordId = requireString(data.linkRecordId, '@core.tenant/portal.create.denied');
  const values = data.data && typeof data.data === 'object' && !Array.isArray(data.data)
    ? (data.data as Record<string, unknown>)
    : {};
  const browserLocale = typeof data.locale === 'string' ? data.locale : '';
  const di = getDI();
  try {
    return await di.getSubmitPortalRecordUseCase().execute({ tenantId, userId, collection, linkRecordId, data: values });
  } catch (error) {
    if (error instanceof PortalSubmissionInvalid) {
      const settings = di.getTenantSettingsRepository();
      const [own, office, guest] = await Promise.all([
        settings.getUserValues(tenantId, userId),
        settings.getTenantValues(tenantId),
        di.getPortalRepository().getPortalUser(tenantId, userId),
      ]);
      const catalog = agentCatalog(
        await di.getInstalledExtensionCache().messageBundles(tenantId),
        configuredLocale(own, office) ?? guest?.locale ?? (browserLocale || DEFAULT_LOCALE),
      );
      throw new HttpsError('invalid-argument', agentText(catalog, error.message, error.params).text);
    }
    throw asHttpsError(error, 'submitPortalRecord');
  }
});

/**
 * O convidado anexa um documento que deixou na área de espera. A callable é a ÚNICA porta: o Storage
 * o deixa só criar ali, e é aqui que se confere se ele pode anexar àquele registro e com aquele tipo.
 */
export const attachPortalDocument = onCall({ region: REGION, cors: true, memory: '512MiB' }, async (request) => {
  const userId = authenticated(request.auth);
  const data = (request.data ?? {}) as Record<string, unknown>;
  const tenantId = requireString(data.tenantId, '@core.automation/handler.tenant.missing');
  const collection = requireString(data.collection, '@core.tenant/portal.upload.denied');
  const recordId = requireString(data.recordId, '@core.tenant/portal.upload.denied');
  const uploadId = requireString(data.uploadId, '@core.tenant/portal.upload.missing');
  const name = requireString(data.name, '@core.tenant/portal.upload.missing');
  const type = requireString(data.type, '@core.tenant/portal.upload.type-invalid');
  try {
    const di = getDI();
    const catalog = agentCatalog(await di.getInstalledExtensionCache().messageBundles(tenantId), DEFAULT_LOCALE);
    const actor = await identifyActor(userId, 'portal', []);
    return await di.getAttachPortalDocumentUseCase((id) => documentTypeOptions(id, catalog)).execute({
      tenantId, userId, userName: actor.name, collection, recordId, uploadId, name, type,
    });
  } catch (error) {
    throw asHttpsError(error, 'attachPortalDocument');
  }
});
