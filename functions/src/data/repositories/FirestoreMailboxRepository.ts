import { randomInt } from 'node:crypto';
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
  MAIL_INBOUND_TOKEN_LENGTH,
  isPolledMailbox,
  mailboxKeepsCursor,
} from '../../domain/schema/mailbox';
import type { ForwardingConfirmation, MailboxHealth, MailboxSettings } from '../../domain/schema/mailbox';
import { workflowEventDocument, workflowEventsRef } from '../services/workflowEventDocument';

const SECRET_DOC = 'current';

/**
 * O índice código → caixa, na RAIZ: a mensagem encaminhada chega sem escritório nenhum, só com o endereço, e
 * uma consulta de grupo por `inboundToken` pediria índice e leria a coleção de todo escritório. Só o servidor.
 */
const INBOUND_ADDRESSES = 'mail_inbound_addresses';

const TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const newInboundToken = (): string =>
  Array.from({ length: MAIL_INBOUND_TOKEN_LENGTH }, () => TOKEN_ALPHABET[randomInt(TOKEN_ALPHABET.length)]).join('');

const confirmationOf = (value: unknown): ForwardingConfirmation | null => {
  const confirmation = value as Record<string, unknown> | null | undefined;
  if (!confirmation || typeof confirmation.receivedAt !== 'string') return null;
  return { code: text(confirmation.code), url: text(confirmation.url), receivedAt: confirmation.receivedAt };
};

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
    backfillDays: typeof data.backfillDays === 'number' ? data.backfillDays : 0,
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
    inboundToken: typeof data.inboundToken === 'string' && data.inboundToken ? data.inboundToken : null,
    forwardingConfirmation: confirmationOf(data.forwardingConfirmation),
  };
};

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
      const keepsCursor = previous !== null && mailboxKeepsCursor(previous, input.settings);
      const hasPassword = input.password !== null || (snap.exists && snap.data()?.hasPassword === true);
      const polled = isPolledMailbox(input.settings.source);
      const currentToken = typeof snap.data()?.inboundToken === 'string' ? (snap.data()?.inboundToken as string) : null;
      // O código nasce uma vez e não muda ao salvar: trocá-lo quebraria a regra de encaminhamento que a pessoa
      // já criou no Gmail. Sai só quando a caixa deixa de ser de encaminhamento.
      const inboundToken = polled ? null : currentToken ?? newInboundToken();
      if (inboundToken && inboundToken !== currentToken) {
        tx.create(this.db.collection(INBOUND_ADDRESSES).doc(inboundToken), { tenantId: input.tenantId, mailboxId: ref.id });
      }
      if (currentToken && currentToken !== inboundToken) tx.delete(this.db.collection(INBOUND_ADDRESSES).doc(currentToken));

      tx.set(ref, {
        ...input.settings,
        ownerId: snap.exists ? (snap.data()?.ownerId ?? null) : input.ownerId,
        hasPassword,
        inboundToken,
        // Salvar põe a caixa lida na fila da próxima volta: quem acabou de configurar quer ver o resultado. A de
        // encaminhamento não entra na fila — ela recebe, não é lida.
        nextPollAt: polled ? now : null,
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
    await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const token = snap.data()?.inboundToken;
      if (typeof token === 'string' && token) tx.delete(this.db.collection(INBOUND_ADDRESSES).doc(token));
      tx.delete(ref.collection('secrets').doc(SECRET_DOC));
      tx.delete(ref);
    });
  }

  async getMessage(tenantId: string, key: string): Promise<{ mailboxId: string; rawStoragePath: string | null } | null> {
    const snap = await this.db.collection('tenants').doc(tenantId).collection(MAIL_MESSAGES_COLLECTION).doc(key).get();
    const data = snap.data();
    if (!data) return null;
    return {
      mailboxId: text(data.mailboxId),
      rawStoragePath: typeof data.rawStoragePath === 'string' && data.rawStoragePath ? data.rawStoragePath : null,
    };
  }

  async findByInboundToken(token: string): Promise<MailboxRef | null> {
    const snap = await this.db.collection(INBOUND_ADDRESSES).doc(token).get();
    const data = snap.data();
    return typeof data?.tenantId === 'string' && typeof data?.mailboxId === 'string'
      ? { tenantId: data.tenantId, id: data.mailboxId }
      : null;
  }

  async recordInbound(
    ref: MailboxRef,
    update: { health?: MailboxHealth; forwardingConfirmation?: ForwardingConfirmation | null },
  ): Promise<void> {
    const docRef = this.mailboxes(ref.tenantId).doc(ref.id);
    await this.db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists) return;
      tx.update(docRef, {
        ...(update.health ? { health: update.health } : {}),
        ...(update.forwardingConfirmation !== undefined ? { forwardingConfirmation: update.forwardingConfirmation } : {}),
      });
    });
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
        nextPollAt: outcome.nextPollAt ? Timestamp.fromDate(outcome.nextPollAt) : null,
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
