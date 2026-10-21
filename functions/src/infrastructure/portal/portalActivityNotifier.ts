import type { PortalActivityNotifier } from '../../domain/usecases/PortalAccessUseCases';
import { collectionPermissionId } from '../../domain/schema/access/permission';
import { PERMISSION_PORTAL_ACTIVITY } from '../../domain/schema/access/kernelPermissions';
import { portalRecordTitle } from '../../domain/schema/portal';
import { configuredLocale, settingsValuesOf } from '../../domain/services/tenantSettings';
import { DEFAULT_LOCALE } from '../../domain/schema/i18n/localeNegotiation';
import { agentCatalog, agentText } from '../agent/agentMessages';
import { getDb } from '../firebase/initFirebase';
import { getDI } from '../di/container';

/** O tipo do aviso, declarado pelo dono do ponto (`core.automation`) em `notification.category`. */
export const PORTAL_ACTIVITY_CATEGORY = 'core.automation/portal-activity';

/**
 * O escritório fica sabendo do que o convidado fez — pela MESMA porta das automações.
 *
 * Recebe quem pode alterar a coleção E responde pelo portal (`portal.activity`): numa prefeitura,
 * muitos mexem nos dados de uma empresa, e poucos são os responsáveis técnicos. Cada pessoa escolhe,
 * na página de Avisos, por quais canais recebe este tipo.
 *
 * O nome da tela entra já traduzido no idioma do escritório: os parâmetros de um aviso são texto, e
 * o título dela pode ser uma referência de extensão. Falhar aqui nunca desfaz o que o convidado fez.
 */
export const portalActivityNotifier: PortalActivityNotifier = async ({ tenantId, userId, kind, screen, recordId, dedupKey }) => {
  if (screen.portal?.notifyOffice === false) return;
  const di = getDI();
  const [guest, record, office] = await Promise.all([
    di.getPortalRepository().getPortalUser(tenantId, userId),
    di.getPortalRepository().getRecord(tenantId, screen.collection, recordId),
    getDb().collection('tenants').doc(tenantId).collection('settings').doc('tenant').get(),
  ]);
  const catalog = agentCatalog(
    await di.getInstalledExtensionCache().messageBundles(tenantId),
    configuredLocale({}, settingsValuesOf(office.data())) ?? DEFAULT_LOCALE,
  );
  const params = {
    guest: guest?.displayName || guest?.email || '',
    screen: agentText(catalog, screen.titleSingular).text,
    record: (record ? portalRecordTitle(screen, record) : '') || recordId,
  };
  await di.getDispatchNotificationUseCase().execute({
    tenantId,
    source: 'core.tenant/portal',
    title: `@core.records/portal.activity.${kind}.title`,
    message: `@core.records/portal.activity.${kind}.message`,
    params,
    link: '',
    target: { collection: screen.collection, recordId },
    category: PORTAL_ACTIVITY_CATEGORY,
    ...(dedupKey ? { dedupKey } : {}),
    channels: { audit: false, inApp: true, email: true, push: true },
    recipientIds: [],
    recipientPermissions: [collectionPermissionId(screen.collection, 'update'), PERMISSION_PORTAL_ACTIVITY],
  });
};
