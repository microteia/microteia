import { createHmac, randomBytes } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type {
  ContactAddress,
  ContactState,
  INotificationAppearance,
  INotificationContactLog,
  INotificationSmsConfigRepository,
  NotificationSmsCredential,
  INotificationDirectory,
  INotificationDispatchLog,
  INotificationEmailConfigRepository,
  INotificationInboxRepository,
  NotificationEmailCredential,
  NotificationRecipient,
  PortalGuestContact,
} from '../../domain/repositories/INotificationDelivery';
import type { InboxNotificationDocument, NotificationEmailSettings } from '../../domain/schema/notifications';
import {
  asNotificationMutes,
  EMPTY_NOTIFICATION_EMAIL_SETTINGS,
  NOTIFICATION_DISPATCHES_COLLECTION,
  NOTIFICATION_MUTED_SETTING_KEY,
  NOTIFICATION_EMAIL_SECRET_ID,
  NOTIFICATION_INBOX_COLLECTION,
  PERSONAL_NOTIFICATION_CHANNELS,
  notificationChannelProperty,
} from '../../domain/schema/notifications';
import { resolveSetting } from '../../domain/schema/settings';
import type { ContactChannel, NotificationSmsSettings } from '../../domain/schema/notificationContacts';
import {
  EMPTY_NOTIFICATION_SMS_SETTINGS,
  NOTIFICATION_CONTACTS_COLLECTION,
  NOTIFICATION_SMS_SECRET_ID,
  SMS_PROVIDERS,
} from '../../domain/schema/notificationContacts';
import {
  asNotificationEmailLayout,
  asNotificationTemplates,
  NOTIFICATION_EMAIL_LAYOUT_SETTING,
  NOTIFICATION_TEMPLATES_SETTING,
} from '../../domain/schema/notificationTemplate';
import { UNRESTRICTED_PERMISSION } from '../../domain/schema/access';
import { preferredLocale, settingsValuesOf } from '../../domain/services/tenantSettings';

export class FirestoreNotificationDirectory implements INotificationDirectory {
  constructor(private readonly db: Firestore) {}

  async recipients(tenantId: string, userIds: readonly string[]): Promise<NotificationRecipient[]> {
    if (userIds.length === 0) return [];
    const tenantRef = this.db.collection('tenants').doc(tenantId);
    const memberRefs = userIds.map((id) => tenantRef.collection('members').doc(id));
    const settingsRefs = userIds.map((id) => tenantRef.collection('settings').doc(`user_${id}`));

    const [members, ownSettings, officeSettings] = await Promise.all([
      this.db.getAll(...memberRefs),
      this.db.getAll(...settingsRefs),
      tenantRef.collection('settings').doc('tenant').get(),
    ]);

    const office = settingsValuesOf(officeSettings.data());
    const ownById = new Map(ownSettings.map((snap, index) => [userIds[index], settingsValuesOf(snap.data())]));

    return members
      .filter((snap) => snap.exists)
      .map((snap) => {
        const own = ownById.get(snap.id) ?? {};
        const values = { user: own, tenant: office };
        const email = snap.data()?.email;
        return {
          userId: snap.id,
          email: typeof email === 'string' ? email.trim() : '',
          locale: preferredLocale(own, office),
          channels: Object.fromEntries(
            PERSONAL_NOTIFICATION_CHANNELS.map((channel) => [
              channel,
              resolveSetting(notificationChannelProperty(channel), values).value === true,
            ]),
          ) as NotificationRecipient['channels'],
          mutes: asNotificationMutes(own[NOTIFICATION_MUTED_SETTING_KEY]),
        };
      });
  }

  async guests(tenantId: string, contacts: readonly PortalGuestContact[]): Promise<NotificationRecipient[]> {
    if (contacts.length === 0) return [];
    const officeSettings = await this.db.collection('tenants').doc(tenantId).collection('settings').doc('tenant').get();
    const office = settingsValuesOf(officeSettings.data());
    const values = { user: {}, tenant: office };
    const officeLocale = preferredLocale({}, office);
    return contacts.map((contact) => ({
      userId: contact.userId,
      email: contact.email.trim(),
      locale: contact.locale || officeLocale,
      channels: {
        inApp: resolveSetting(notificationChannelProperty('inApp'), values).value === true,
        email: resolveSetting(notificationChannelProperty('email'), values).value === true,
        push: false,
      },
      mutes: {},
    }));
  }

  async officeLocale(tenantId: string): Promise<string> {
    const officeSettings = await this.db.collection('tenants').doc(tenantId).collection('settings').doc('tenant').get();
    return preferredLocale({}, settingsValuesOf(officeSettings.data()));
  }

  async memberIdsGranting(tenantId: string, permission: string, limit: number): Promise<string[]> {
    const tenantRef = this.db.collection('tenants').doc(tenantId);
    const [granted, tenant] = await Promise.all([
      tenantRef
        .collection('members')
        .where('permissions', 'array-contains-any', [permission, UNRESTRICTED_PERMISSION])
        .limit(limit)
        .select()
        .get(),
      tenantRef.get(),
    ]);
    const ids = granted.docs.map((doc) => doc.id);
    const ownerId = tenant.data()?.ownerId;
    // O dono tem tudo, e não pode depender de a materialização já ter rodado — a mesma exceção das
    // Security Rules. A conferência de que ele é membro fica com `recipients`.
    if (typeof ownerId === 'string' && ownerId && !ids.includes(ownerId)) ids.push(ownerId);
    return ids;
  }
}

/** A cara dos avisos: o que o escritório gravou nas configurações dele, e o logo do escritório. */
export class FirestoreNotificationAppearance implements INotificationAppearance {
  constructor(private readonly db: Firestore) {}

  async get(tenantId: string) {
    const tenantRef = this.db.collection('tenants').doc(tenantId);
    const [office, tenant] = await Promise.all([tenantRef.collection('settings').doc('tenant').get(), tenantRef.get()]);
    const values = settingsValuesOf(office.data());
    const logoURL = tenant.data()?.logoURL;
    return {
      layout: asNotificationEmailLayout(values[NOTIFICATION_EMAIL_LAYOUT_SETTING]),
      templates: asNotificationTemplates(values[NOTIFICATION_TEMPLATES_SETTING]),
      logoURL: typeof logoURL === 'string' && logoURL ? logoURL : null,
    };
  }
}

/** Firestore responde ALREADY_EXISTS (6) quando o `create` acha o documento. */
const ALREADY_EXISTS = 6;

export class FirestoreNotificationDispatchLog implements INotificationDispatchLog {
  constructor(private readonly db: Firestore) {}

  async claim(tenantId: string, dispatchId: string, expiresAt: Date): Promise<boolean> {
    try {
      await this.db.collection('tenants').doc(tenantId).collection(NOTIFICATION_DISPATCHES_COLLECTION).doc(dispatchId)
        .create({ createdAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromDate(expiresAt) });
      return true;
    } catch (error) {
      if ((error as { code?: unknown }).code === ALREADY_EXISTS) return false;
      throw error;
    }
  }
}

export class FirestoreNotificationInboxRepository implements INotificationInboxRepository {
  constructor(private readonly db: Firestore) {}

  async deliver(tenantId: string, notifications: readonly InboxNotificationDocument[]): Promise<void> {
    if (notifications.length === 0) return;
    const collection = this.db.collection('tenants').doc(tenantId).collection(NOTIFICATION_INBOX_COLLECTION);
    const batch = this.db.batch();
    for (const notification of notifications) {
      batch.set(collection.doc(), {
        ...notification,
        createdAt: Timestamp.fromDate(notification.createdAt),
        expiresAt: Timestamp.fromDate(notification.expiresAt),
      });
    }
    await batch.commit();
  }
}

const settingsOf = (data: Record<string, unknown>): NotificationEmailSettings => ({
  host: typeof data.host === 'string' ? data.host : EMPTY_NOTIFICATION_EMAIL_SETTINGS.host,
  port: typeof data.port === 'number' ? data.port : EMPTY_NOTIFICATION_EMAIL_SETTINGS.port,
  secure: data.secure === true,
  username: typeof data.username === 'string' ? data.username : '',
  fromAddress: typeof data.fromAddress === 'string' ? data.fromAddress : '',
  fromName: typeof data.fromName === 'string' ? data.fromName : '',
  appUrl: typeof data.appUrl === 'string' ? data.appUrl : '',
});

/**
 * A credencial vive em `tenants/{tid}/secrets/notification-email`. `secrets` é coleção reservada e
 * nenhuma regra a libera: o navegador não lê nem grava — só as callables, pelo Admin SDK.
 */
export class FirestoreNotificationEmailConfigRepository implements INotificationEmailConfigRepository {
  constructor(private readonly db: Firestore) {}

  private ref(tenantId: string) {
    return this.db.collection('tenants').doc(tenantId).collection('secrets').doc(NOTIFICATION_EMAIL_SECRET_ID);
  }

  async get(tenantId: string): Promise<NotificationEmailCredential | null> {
    const snap = await this.ref(tenantId).get();
    const data = snap.data();
    if (!data) return null;
    return { settings: settingsOf(data), password: typeof data.password === 'string' ? data.password : '' };
  }

  async save(
    tenantId: string,
    settings: NotificationEmailSettings,
    password: string | null,
    userId: string,
  ): Promise<void> {
    await this.ref(tenantId).set(
      {
        ...settings,
        ...(password !== null ? { password } : {}),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: userId,
      },
      { merge: true },
    );
  }

  async clear(tenantId: string): Promise<void> {
    await this.ref(tenantId).delete();
  }
}

const smsSettingsOf = (data: Record<string, unknown>): NotificationSmsSettings => {
  const text = (value: unknown): string => (typeof value === 'string' ? value : '');
  const provider = SMS_PROVIDERS.find((one) => one === data.provider) ?? EMPTY_NOTIFICATION_SMS_SETTINGS.provider;
  return {
    provider,
    accountSid: text(data.accountSid),
    fromNumber: text(data.fromNumber),
    webhookUrl: text(data.webhookUrl),
    defaultCountryCode: text(data.defaultCountryCode),
    appUrl: text(data.appUrl),
  };
};

/** A credencial de SMS mora ao lado da de e-mail, em `secrets` — coleção que nenhuma regra libera. */
export class FirestoreNotificationSmsConfigRepository implements INotificationSmsConfigRepository {
  constructor(private readonly db: Firestore) {}

  private ref(tenantId: string) {
    return this.db.collection('tenants').doc(tenantId).collection('secrets').doc(NOTIFICATION_SMS_SECRET_ID);
  }

  async get(tenantId: string): Promise<NotificationSmsCredential | null> {
    const data = (await this.ref(tenantId).get()).data();
    if (!data) return null;
    return { settings: smsSettingsOf(data), secret: typeof data.secret === 'string' ? data.secret : '' };
  }

  async save(tenantId: string, settings: NotificationSmsSettings, secret: string | null, userId: string): Promise<void> {
    await this.ref(tenantId).set(
      {
        ...settings,
        ...(secret !== null ? { secret } : {}),
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: userId,
      },
      { merge: true },
    );
  }

  async clear(tenantId: string): Promise<void> {
    await this.ref(tenantId).delete();
  }
}

/**
 * A chave com que os bilhetes de descadastro são derivados. É da INSTALAÇÃO, sorteada na primeira vez
 * que alguém precisa dela, e mora numa coleção de raiz que nenhuma regra libera — como as chaves VAPID.
 * Ninguém a configura: um passo manual a mais numa instalação que não deve ter nenhum.
 */
export class ContactTicketKeyStore {
  private cached: Promise<Buffer> | null = null;

  constructor(private readonly db: Firestore) {}

  key(): Promise<Buffer> {
    if (!this.cached) {
      this.cached = this.loadOrCreate().catch((error) => {
        this.cached = null;
        throw error;
      });
    }
    return this.cached;
  }

  private async loadOrCreate(): Promise<Buffer> {
    const ref = this.db.collection('kernel_secrets').doc('notification-contacts');
    return this.db.runTransaction(async (transaction) => {
      const data = (await transaction.get(ref)).data();
      if (typeof data?.key === 'string' && data.key) return Buffer.from(data.key, 'base64');
      const generated = randomBytes(32);
      transaction.set(ref, { key: generated.toString('base64'), createdAt: new Date() });
      return generated;
    });
  }
}

/** O bilhete: 192 bits do HMAC de escritório, canal e endereço — o id do documento e o fim do link. */
export const contactTicketOf = (key: Buffer, tenantId: string, contact: ContactAddress): string =>
  createHmac('sha256', key).update(`${tenantId}\n${contact.channel}\n${contact.address}`, 'utf8').digest('base64url').slice(0, 32);

const contactChannelOf = (value: unknown): ContactChannel | null =>
  value === 'email' || value === 'sms' ? value : null;

/**
 * `tenants/{tid}/notification_contacts/{bilhete}`: os endereços que o escritório já alcançou, e o que
 * cada um decidiu. Guardar o endereço é o que deixa o descadastro aparecer na Auditoria com quem o
 * pediu — e é o mesmo endereço que já está no registro do escritório.
 */
export class FirestoreNotificationContactLog implements INotificationContactLog {
  constructor(private readonly db: Firestore, private readonly keys: ContactTicketKeyStore) {}

  private collection(tenantId: string) {
    return this.db.collection('tenants').doc(tenantId).collection(NOTIFICATION_CONTACTS_COLLECTION);
  }

  async status(tenantId: string, addresses: readonly ContactAddress[]): Promise<ContactState[]> {
    if (addresses.length === 0) return [];
    const key = await this.keys.key();
    const collection = this.collection(tenantId);
    const tickets = addresses.map((contact) => contactTicketOf(key, tenantId, contact));
    const snaps = await this.db.getAll(...tickets.map((ticket) => collection.doc(ticket)));
    return addresses.map((contact, index) => ({
      ...contact,
      ticket: tickets[index],
      optedOut: snaps[index].data()?.optedOut === true,
    }));
  }

  async touch(tenantId: string, contacts: readonly ContactState[], at: Date): Promise<void> {
    if (contacts.length === 0) return;
    const collection = this.collection(tenantId);
    const batch = this.db.batch();
    for (const contact of contacts) {
      batch.set(
        collection.doc(contact.ticket),
        { channel: contact.channel, address: contact.address, lastSentAt: Timestamp.fromDate(at) },
        { merge: true },
      );
    }
    await batch.commit();
  }

  async find(tenantId: string, ticket: string): Promise<ContactState | null> {
    const data = (await this.collection(tenantId).doc(ticket).get()).data();
    const channel = contactChannelOf(data?.channel);
    if (!data || !channel || typeof data.address !== 'string') return null;
    return { channel, address: data.address, ticket, optedOut: data.optedOut === true };
  }

  async setOptedOut(tenantId: string, ticket: string, optedOut: boolean, at: Date): Promise<void> {
    await this.collection(tenantId).doc(ticket).update({
      optedOut,
      optedOutAt: optedOut ? Timestamp.fromDate(at) : null,
    });
  }
}
