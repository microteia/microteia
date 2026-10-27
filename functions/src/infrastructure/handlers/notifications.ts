import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { PERMISSION_SETTINGS_MANAGE } from '../../domain/schema/access/kernelPermissions';
import type { NotificationEmailSettings, NotificationEmailSettingsView } from '../../domain/schema/notifications';
import {
  EMPTY_NOTIFICATION_EMAIL_SETTINGS,
  isEmailAddress,
  notificationEmailSettingsIssue,
} from '../../domain/schema/notifications';
import { notificationLinkUrl, renderNotificationEmail } from '../../domain/services/notificationEmail';
import { SmtpEmailTransport } from '../../data/services/NotificationTransports';
import { FirestoreNotificationAppearance } from '../../data/repositories/FirestoreNotificationRepositories';
import { fillNotificationTemplate } from '../../domain/schema/notificationTemplate';
import { getDb } from '../firebase/initFirebase';
import { agentLocale } from '../agent/agentLocale';
import { makeNotificationTextCatalog } from '../notifications/notificationTextCatalog';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';

const REGION = 'southamerica-east1';

type EmailOperation = 'get' | 'save' | 'clear' | 'test';

interface ManageNotificationEmailRequest {
  tenantId: string;
  op: EmailOperation;
  settings?: Partial<NotificationEmailSettings>;
  /** Ausente ou vazio MANTÉM a senha gravada: o formulário nunca a recebe de volta. */
  password?: string;
}

const textField = (value: unknown, max = 320): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const settingsFrom = (input: Partial<NotificationEmailSettings> | undefined): NotificationEmailSettings => ({
  host: textField(input?.host, 255),
  port: typeof input?.port === 'number' ? input.port : Number(input?.port ?? EMPTY_NOTIFICATION_EMAIL_SETTINGS.port),
  secure: input?.secure === true,
  username: textField(input?.username),
  fromAddress: textField(input?.fromAddress),
  fromName: textField(input?.fromName, 120),
  appUrl: textField(input?.appUrl, 500).replace(/\/+$/, ''),
});

const viewOf = async (tenantId: string): Promise<NotificationEmailSettingsView> => {
  const credential = await getDI().getNotificationEmailConfigRepository().get(tenantId);
  return credential
    ? { ...credential.settings, configured: true, hasPassword: credential.password !== '' }
    : { ...EMPTY_NOTIFICATION_EMAIL_SETTINGS, configured: false, hasPassword: false };
};

const sendTest = async (tenantId: string, userId: string, email: unknown): Promise<{ sentTo: string }> => {
  const credential = await getDI().getNotificationEmailConfigRepository().get(tenantId);
  if (!credential) throw new HttpsError('failed-precondition', '@core.automation/step.notify.email.not-configured');
  if (typeof email !== 'string' || !isEmailAddress(email)) {
    throw new HttpsError('failed-precondition', '@core.automation/notifications.email.test.no-address');
  }

  const resolve = await makeNotificationTextCatalog(getDI().getInstalledExtensionCache())
    .resolverFor(tenantId, await agentLocale(tenantId, userId));
  const tenant = (await getDI().getTenantRepository().getById(tenantId))?.name ?? '';
  // O teste sai com a MESMA cara dos avisos — é o que o escritório quer conferir ao testar.
  const look = await new FirestoreNotificationAppearance(getDb()).get(tenantId);
  const session = new SmtpEmailTransport().open(credential);
  try {
    await session.send(renderNotificationEmail({
      to: email,
      title: resolve('@core.automation/notifications.email.test.subject', {}),
      message: resolve('@core.automation/notifications.email.test.body', {}),
      linkUrl: notificationLinkUrl(credential.settings.appUrl, '/'),
      linkLabel: resolve('@core.automation/notifications.email.open', {}),
      footer: look.layout.footer
        ? fillNotificationTemplate(look.layout.footer, { tenant })
        : resolve('@core.automation/notifications.email.footer', { tenant }),
      tenantName: tenant,
      logoURL: look.logoURL,
      layout: look.layout,
    }));
  } catch (error) {
    throw new HttpsError('failed-precondition', '@core.automation/notifications.email.test.failed', {
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    session.close();
  }
  return { sentTo: email };
};

/**
 * A credencial de e-mail do escritório — a única porta pela qual ela é lida ou gravada.
 *
 * A senha entra e nunca sai: `get` devolve SE ela existe, não qual é. As quatro operações exigem
 * `settings.manage`, a mesma permissão que grava o padrão do escritório em Configurações.
 *
 * `test` envia para o e-mail de QUEM PEDIU, e não para um endereço escolhido: um teste que aceitasse
 * destinatário livre seria um relé de e-mail aberto a qualquer um com a permissão.
 */
export const manageNotificationEmail = onCall(
  { region: REGION, cors: true },
  async (request): Promise<NotificationEmailSettingsView | { sentTo: string }> => {
    if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');

    const { tenantId, op, settings, password } = (request.data ?? {}) as ManageNotificationEmailRequest;
    if (!tenantId) throw new HttpsError('invalid-argument', '@core.automation/handler.tenant.missing');

    const userId = request.auth.uid;
    await requirePermission(tenantId, request.auth, PERMISSION_SETTINGS_MANAGE);
    const repository = getDI().getNotificationEmailConfigRepository();

    switch (op) {
      case 'get':
        return viewOf(tenantId);
      case 'save': {
        const next = settingsFrom(settings);
        const issue = notificationEmailSettingsIssue(next);
        if (issue) throw new HttpsError('invalid-argument', issue);
        const typed = typeof password === 'string' && password !== '' ? password.slice(0, 1024) : null;
        await repository.save(tenantId, next, typed, userId);
        return viewOf(tenantId);
      }
      case 'clear':
        await repository.clear(tenantId);
        return viewOf(tenantId);
      case 'test':
        return sendTest(tenantId, userId, request.auth.token.email);
      default:
        throw new HttpsError('invalid-argument', '@core.automation/notifications.email.op.invalid');
    }
  },
);

/** A chave PÚBLICA de push da instalação, que o navegador usa para se inscrever. Qualquer pessoa logada. */
export const getWebPushPublicKey = onCall(
  { region: REGION, cors: true },
  async (request): Promise<{ publicKey: string }> => {
    if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    return { publicKey: (await getDI().getVapidKeyStore().keys()).publicKey };
  },
);
