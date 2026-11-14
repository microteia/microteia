import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentData, DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import type {
  IMailboxRepository,
  MailDelivery,
  MailboxCursor,
  MailboxPollOutcome,
  MailboxRef,
  StoredMailbox,
} from '../../domain/repositories/IMailboxRepository';
import {
  EMPTY_IMAP_SETTINGS,
  MAILBOXES_COLLECTION,
  MAILBOX_DEFAULT_POLL_MINUTES,
  MAILBOX_SOURCES,
  MAIL_MESSAGES_COLLECTION,
  MAIL_RECEIVED_EVENT,
  MAILBOX_FAILURE_REASONS,
} from '../../domain/schema/mailbox';
import type { MailboxHealth, MailboxSettings } from '../../domain/schema/mailbox';
import { workflowEventDocument, workflowEventsRef } from '../services/workflowEventDocument';

const SECRET_DOC = 'current';

const toDate = (value: unknown): Date | null => (value instanceof Timestamp ? value.toDate() : null);
const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const isoOrNull = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

const settingsOf = (data: DocumentData): MailboxSettings => {
  const imap = (data.imap ?? {}) as Record<string, unknown>;
  return {
    name: text(data.name),
    source: MAILBOX_SOURCES.find((source) => source === data.source) ?? 'imap',
    imap: {
      host: text(imap.host),
      port: typeof imap.port === 'number' ? imap.port : EMPTY_IMAP_SETTINGS.port,
      secure: imap.secure !== false,
      username: text(imap.username),
      folder: text(imap.folder) || EMPTY_IMAP_SETTINGS.folder,
    },
    pollEveryMinutes: typeof data.pollEveryMinutes === 'number' ? data.pollEveryMinutes : MAILBOX_DEFAULT_POLL_MINUTES,
    subscriptions: Array.isArray(data.subscriptions) ? data.subscriptions.filter((id): id is string => typeof id === 'string') : [],
    enabled: data.enabled !== false,
  };
};

const healthOf = (value: unknown): MailboxHealth => {
  const health = (value ?? {}) as Record<string, unknown>;
  const failure = health.failure as Record<string, unknown> | null | undefined;
  const reason = MAILBOX_FAILURE_REASONS.find((one) => one === failure?.reason);
  return {
    lastPolledAt: isoOrNull(health.lastPolledAt),
    lastDeliveredAt: isoOrNull(health.lastDeliveredAt),
    lastDelivered: typeof health.lastDelivered === 'number' ? health.lastDelivered : 0,
    failure: failure && reason ? { reason, message: text(failure.message), at: text(failure.at) } : null,
  };
};

const cursorOf = (value: unknown): MailboxCursor | null => {
  const cursor = value as Record<string, unknown> | null | undefined;
  if (!cursor || typeof cursor.uidValidity !== 'string' || typeof cursor.lastUid !== 'number') return null;
  return { uidValidity: cursor.uidValidity, lastUid: cursor.lastUid };
};

const mapMailbox = (tenantId: string, snap: DocumentSnapshot): StoredMailbox => {
  const data = snap.data() ?? {};
  return {
    tenantId,
    id: snap.id,
    ownerId: typeof data.ownerId === 'string' && data.ownerId ? data.ownerId : null,
    settings: settingsOf(data),
    hasPassword: data.hasPassword === true,
    cursor: cursorOf(data.cursor),
    nextPollAt: toDate(data.nextPollAt),
    health: healthOf(data.health),
  };
};

/** A conta lida — o que, se muda, faz os UIDs gravados não dizerem mais nada. */
const accountOf = (settings: MailboxSettings): string =>
  JSON.stringify([settings.imap.host.trim().toLowerCase(), settings.imap.port, settings.imap.username.trim().toLowerCase(), settings.imap.folder]);

const sameSubscriptions = (a: string[], b: string[]): boolean =>
  a.length === b.length && [...a].sort().every((id, index) => id === [...b].sort()[index]);

export class FirestoreMailboxRepository implements IMailboxRepository {
  constructor(private readonly db: Firestore) {}

  private mailboxes(tenantId: string) {
    return this.db.collection('tenants').doc(tenantId).collection(MAILBOXES_COLLECTION);
  }

  async listForTenant(tenantId: string): Promise<StoredMailbox[]> {
    const snap = await this.mailboxes(tenantId).get();
    return snap.docs.map((doc) => mapMailbox(tenantId, doc));
  }

  async get(tenantId: string, id: string): Promise<StoredMailbox | null> {
    const snap = await this.mailboxes(tenantId).doc(id).get();
    return snap.exists ? mapMailbox(tenantId, snap) : null;
  }

  async save(input: {
    tenantId: string;
    id: string | null;
    ownerId: string | null;
    settings: MailboxSettings;
    password: string | null;
    actorId: string;
    now: Date;
  }): Promise<string> {
    const ref = input.id ? this.mailboxes(input.tenantId).doc(input.id) : this.mailboxes(input.tenantId).doc();
    const now = Timestamp.fromDate(input.now);
    await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const previous = snap.exists ? settingsOf(snap.data() ?? {}) : null;
      const keepsCursor = previous !== null
        && accountOf(previous) === accountOf(input.settings)
        && sameSubscriptions(previous.subscriptions, input.settings.subscriptions);
      const hasPassword = input.password !== null || (snap.exists && snap.data()?.hasPassword === true);

      tx.set(ref, {
        ...input.settings,
        ownerId: snap.exists ? (snap.data()?.ownerId ?? null) : input.ownerId,
        hasPassword,
        // Salvar põe a caixa na fila da próxima volta: quem acabou de configurar quer ver o resultado.
        nextPollAt: now,
        leaseUntil: null,
        ...(keepsCursor ? {} : { cursor: null }),
        ...(snap.exists ? {} : { createdAt: now, createdBy: input.actorId, health: { lastPolledAt: null, lastDeliveredAt: null, lastDelivered: 0, failure: null } }),
        updatedAt: now,
        updatedBy: input.actorId,
      }, { merge: true });
      if (input.password !== null) tx.set(ref.collection('secrets').doc(SECRET_DOC), { password: input.password });
    });
    return ref.id;
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const ref = this.mailboxes(tenantId).doc(id);
    const batch = this.db.batch();
    batch.delete(ref.collection('secrets').doc(SECRET_DOC));
    batch.delete(ref);
    await batch.commit();
  }

  async password(tenantId: string, id: string): Promise<string | null> {
    const snap = await this.mailboxes(tenantId).doc(id).collection('secrets').doc(SECRET_DOC).get();
    const value = snap.data()?.password;
    return typeof value === 'string' && value ? value : null;
  }

  async listDue(now: Date, limit: number): Promise<MailboxRef[]> {
    const snap = await this.db
      .collectionGroup(MAILBOXES_COLLECTION)
      .where('nextPollAt', '<=', Timestamp.fromDate(now))
      .orderBy('nextPollAt')
      .limit(limit)
      .get();
    return snap.docs
      .filter((doc) => doc.ref.parent.parent?.parent.id === 'tenants')
      .map((doc) => ({ tenantId: doc.ref.parent.parent!.id, id: doc.id }));
  }

  async claim(ref: MailboxRef, now: Date, leaseUntil: Date): Promise<StoredMailbox | null> {
    const docRef = this.mailboxes(ref.tenantId).doc(ref.id);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) return null;
      const data = snap.data() ?? {};
      const due = toDate(data.nextPollAt);
      const lease = toDate(data.leaseUntil);
      if (!due || due.getTime() > now.getTime()) return null;
      if (lease && lease.getTime() > now.getTime()) return null;
      tx.update(docRef, { leaseUntil: Timestamp.fromDate(leaseUntil) });
      return mapMailbox(ref.tenantId, snap);
    });
  }

  async release(ref: MailboxRef, outcome: MailboxPollOutcome): Promise<void> {
    const docRef = this.mailboxes(ref.tenantId).doc(ref.id);
    // A caixa apagada durante a leitura não volta à vida por causa dela.
    await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) return;
      tx.update(docRef, {
        cursor: outcome.cursor,
        nextPollAt: Timestamp.fromDate(outcome.nextPollAt),
        health: outcome.health,
        leaseUntil: null,
      });
    });
  }

  async deliver(tenantId: string, delivery: MailDelivery): Promise<'delivered' | 'duplicate'> {
    const messageRef = this.db.collection('tenants').doc(tenantId).collection(MAIL_MESSAGES_COLLECTION).doc(delivery.key);
    const events = workflowEventsRef(this.db, tenantId);
    return this.db.runTransaction(async (tx) => {
      const existing = await tx.get(messageRef);
      if (existing.exists) return 'duplicate';
      tx.create(messageRef, delivery.record);
      for (const event of delivery.events) {
        // `set`, e não `create`: a marca da mensagem expira antes do evento, e a mesma mensagem lida de novo
        // depois disso reescreve o evento antigo — o que não é criação e não acorda a automação outra vez.
        tx.set(events.doc(event.id), workflowEventDocument(MAIL_RECEIVED_EVENT, { ...event.payload }, { target: event.target }));
      }
      return 'delivered';
    });
  }
}
