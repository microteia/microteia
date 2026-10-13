import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type {
  INotificationDirectory,
  INotificationEmailConfigRepository,
  INotificationInboxRepository,
  NotificationEmailCredential,
  NotificationRecipient,
} from '../../domain/repositories/INotificationDelivery';
import type { InboxNotificationDocument, NotificationEmailSettings } from '../../domain/schema/notifications';
import {
  EMPTY_NOTIFICATION_EMAIL_SETTINGS,
  NOTIFICATION_EMAIL_SECRET_ID,
  NOTIFICATION_INBOX_COLLECTION,
  PERSONAL_NOTIFICATION_CHANNELS,
  notificationChannelProperty,
} from '../../domain/schema/notifications';
import { resolveSetting } from '../../domain/schema/settings';
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
        };
      });
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
