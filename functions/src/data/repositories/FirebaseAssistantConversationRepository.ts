import type { DocumentData, Firestore } from 'firebase-admin/firestore';
import type {
  AssistantConversation,
  AssistantLease,
  IAssistantConversationRepository,
} from '../../domain/repositories/IAssistantConversationRepository';
import type {
  AssistantConversationRecord,
  AssistantMessageRecord,
} from '../../domain/schema/assistant/assistantConversation';
import {
  ASSISTANT_CONVERSATIONS_COLLECTION,
  ASSISTANT_LEASE_MS,
  ASSISTANT_MESSAGES_SUBCOLLECTION,
  assistantMessageId,
} from '../../domain/schema/assistant/assistantConversation';

const toConversation = (id: string, data: DocumentData): AssistantConversation => ({
  id,
  ownerId: String(data.ownerId ?? ''),
  title: String(data.title ?? ''),
  status: data.status === 'running' || data.status === 'awaiting-approval' ? data.status : 'idle',
  leaseUntil: typeof data.leaseUntil === 'number' ? data.leaseUntil : null,
  pendingCalls: Array.isArray(data.pendingCalls) ? data.pendingCalls : [],
  contextStart: typeof data.contextStart === 'number' ? data.contextStart : 0,
  lastInputTokens: typeof data.lastInputTokens === 'number' ? data.lastInputTokens : 0,
  messageCount: typeof data.messageCount === 'number' ? data.messageCount : 0,
  createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
  updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
});

/**
 * O Firestore recusa `undefined` em qualquer profundidade, e uma parte opcional ausente (`meta`,
 * `interrupted`) chega assim de quem montou a mensagem. Uma ida e volta por JSON é a limpeza que
 * cobre a árvore inteira, e o conteúdo da conversa já é JSON por natureza.
 */
const firestoreSafe = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class FirebaseAssistantConversationRepository implements IAssistantConversationRepository {
  constructor(private readonly db: Firestore) {}

  private conversations(tenantId: string) {
    return this.db.collection('tenants').doc(tenantId).collection(ASSISTANT_CONVERSATIONS_COLLECTION);
  }

  async create(tenantId: string, ownerId: string, title: string, now: number): Promise<AssistantConversation> {
    const ref = this.conversations(tenantId).doc();
    const record: AssistantConversationRecord = {
      ownerId,
      title,
      status: 'running',
      leaseUntil: now + ASSISTANT_LEASE_MS,
      pendingCalls: [],
      contextStart: 0,
      lastInputTokens: 0,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(record);
    return { id: ref.id, ...record };
  }

  async acquire(tenantId: string, conversationId: string, ownerId: string, now: number): Promise<AssistantLease> {
    const ref = this.conversations(tenantId).doc(conversationId);
    return this.db.runTransaction(async (transaction): Promise<AssistantLease> => {
      const snap = await transaction.get(ref);
      if (!snap.exists) return { ok: false, reason: 'not-found' };
      const conversation = toConversation(snap.id, snap.data() ?? {});
      if (conversation.ownerId !== ownerId) return { ok: false, reason: 'not-found' };
      if (conversation.status === 'running' && (conversation.leaseUntil ?? 0) > now) return { ok: false, reason: 'busy' };
      transaction.update(ref, { status: 'running', leaseUntil: now + ASSISTANT_LEASE_MS });
      return { ok: true, conversation };
    });
  }

  async get(tenantId: string, conversationId: string): Promise<AssistantConversation | null> {
    const snap = await this.conversations(tenantId).doc(conversationId).get();
    return snap.exists ? toConversation(snap.id, snap.data() ?? {}) : null;
  }

  async loadMessages(tenantId: string, conversationId: string, fromSeq: number, limit: number): Promise<AssistantMessageRecord[]> {
    const snap = await this.conversations(tenantId)
      .doc(conversationId)
      .collection(ASSISTANT_MESSAGES_SUBCOLLECTION)
      .where('seq', '>=', fromSeq)
      .orderBy('seq', 'asc')
      .limit(limit)
      .get();
    return snap.docs.map((doc) => doc.data() as AssistantMessageRecord);
  }

  async appendMessage(tenantId: string, conversationId: string, message: AssistantMessageRecord): Promise<void> {
    await this.conversations(tenantId)
      .doc(conversationId)
      .collection(ASSISTANT_MESSAGES_SUBCOLLECTION)
      .doc(assistantMessageId(message.seq))
      .set(firestoreSafe(message));
  }

  async update(tenantId: string, conversationId: string, patch: Partial<AssistantConversationRecord>): Promise<void> {
    await this.conversations(tenantId).doc(conversationId).update(firestoreSafe(patch));
  }

  async remove(tenantId: string, conversationId: string): Promise<void> {
    await this.db.recursiveDelete(this.conversations(tenantId).doc(conversationId));
  }
}
