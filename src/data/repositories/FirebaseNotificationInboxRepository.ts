import {
  collection, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, Timestamp, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { InboxNotification } from '../../domain/entities/InboxNotification';
import type { INotificationInboxRepository } from '../../domain/repositories/INotificationRepositories';
import { NOTIFICATION_INBOX_COLLECTION } from '../../domain/schema/notifications';

const MARK_ALL_BATCH = 400;

const inbox = (tenantId: string) => collection(db, 'tenants', tenantId, NOTIFICATION_INBOX_COLLECTION);

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

const paramsOf = (value: unknown): Record<string, string> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, String(item)]))
    : {};

const toNotification = (id: string, data: Record<string, unknown>): InboxNotification => ({
  id,
  title: textOf(data.title),
  message: textOf(data.message),
  params: paramsOf(data.params),
  link: textOf(data.link),
  read: data.read === true,
  createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(0),
});

export class FirebaseNotificationInboxRepository implements INotificationInboxRepository {
  subscribeRecent(
    tenantId: string,
    userId: string,
    max: number,
    onChange: (notifications: InboxNotification[]) => void,
  ): () => void {
    const recent = query(inbox(tenantId), where('recipientId', '==', userId), orderBy('createdAt', 'desc'), limit(max));
    return onSnapshot(
      recent,
      (snap) => onChange(snap.docs.map((one) => toNotification(one.id, one.data()))),
      () => onChange([]),
    );
  }

  subscribeUnreadCount(tenantId: string, userId: string, cap: number, onChange: (count: number) => void): () => void {
    const unread = query(
      inbox(tenantId),
      where('recipientId', '==', userId),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(cap),
    );
    return onSnapshot(unread, (snap) => onChange(snap.size), () => onChange(0));
  }

  async markRead(tenantId: string, ids: readonly string[]): Promise<void> {
    const batch = writeBatch(db);
    for (const id of ids) batch.update(doc(inbox(tenantId), id), { read: true, readAt: serverTimestamp() });
    await batch.commit();
  }

  async markAllRead(tenantId: string, userId: string): Promise<void> {
    const unread = await getDocs(query(
      inbox(tenantId),
      where('recipientId', '==', userId),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(MARK_ALL_BATCH),
    ));
    if (unread.empty) return;
    await this.markRead(tenantId, unread.docs.map((one) => one.id));
  }
}
