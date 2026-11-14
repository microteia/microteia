import { collection, limit as limitTo, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../infrastructure/firebase/config';
import type { AssistantConversation, IAssistantRepository } from '../../domain/repositories/IAssistantRepository';
import type {
  AssistantMessageRecord,
  AssistantStreamChunk,
  AssistantTurnRequest,
  AssistantTurnResult,
} from '../../domain/schema/assistant/assistantConversation';
import {
  ASSISTANT_CONVERSATIONS_COLLECTION,
  ASSISTANT_MESSAGES_SUBCOLLECTION,
} from '../../domain/schema/assistant/assistantConversation';
import {
  ASSISTANT_CHAT_FUNCTION,
  ASSISTANT_CONVERSATION_FUNCTION,
} from '../../domain/schema/assistant/assistantBackend';

/** Um pouco acima do teto da function (540 s): quem desiste primeiro tem de ser o servidor. */
const TURN_TIMEOUT_MS = 560_000;

const conversationsRef = (tenantId: string) =>
  collection(db, 'tenants', tenantId, ASSISTANT_CONVERSATIONS_COLLECTION);

const toConversation = (id: string, data: Record<string, unknown>): AssistantConversation => ({
  id,
  ownerId: String(data.ownerId ?? ''),
  title: String(data.title ?? ''),
  status: data.status === 'running' || data.status === 'awaiting-approval' ? data.status : 'idle',
  leaseUntil: typeof data.leaseUntil === 'number' ? data.leaseUntil : null,
  pendingCalls: Array.isArray(data.pendingCalls) ? data.pendingCalls as AssistantConversation['pendingCalls'] : [],
  contextStart: typeof data.contextStart === 'number' ? data.contextStart : 0,
  lastInputTokens: typeof data.lastInputTokens === 'number' ? data.lastInputTokens : 0,
  messageCount: typeof data.messageCount === 'number' ? data.messageCount : 0,
  createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
  updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
});

export class FirebaseAssistantRepository implements IAssistantRepository {
  subscribeConversations(
    tenantId: string,
    userId: string,
    limit: number,
    onChange: (conversations: AssistantConversation[]) => void,
  ): () => void {
    // `ownerId ==` é o que a regra exige para provar a leitura: sem ele, a consulta é recusada inteira.
    const q = query(conversationsRef(tenantId), where('ownerId', '==', userId), orderBy('updatedAt', 'desc'), limitTo(limit));
    return onSnapshot(
      q,
      (snap) => onChange(snap.docs.map((doc) => toConversation(doc.id, doc.data()))),
      () => onChange([]),
    );
  }

  subscribeMessages(
    tenantId: string,
    conversationId: string,
    limit: number,
    onChange: (messages: AssistantMessageRecord[]) => void,
  ): () => void {
    // As ÚLTIMAS mensagens: a consulta desce pelo `seq` e a lista é invertida para a ordem de leitura.
    const q = query(
      collection(conversationsRef(tenantId), conversationId, ASSISTANT_MESSAGES_SUBCOLLECTION),
      orderBy('seq', 'desc'),
      limitTo(limit),
    );
    return onSnapshot(
      q,
      (snap) => onChange(snap.docs.map((doc) => doc.data() as AssistantMessageRecord).reverse()),
      () => onChange([]),
    );
  }

  async sendTurn(
    request: AssistantTurnRequest,
    onChunk: (chunk: AssistantStreamChunk) => void,
    signal: AbortSignal,
  ): Promise<AssistantTurnResult> {
    const call = httpsCallable<AssistantTurnRequest, AssistantTurnResult, AssistantStreamChunk>(
      functions,
      ASSISTANT_CHAT_FUNCTION,
      { timeout: TURN_TIMEOUT_MS },
    );
    const { stream, data } = await call.stream(request, { signal });
    for await (const chunk of stream) onChunk(chunk);
    return data;
  }

  async renameConversation(tenantId: string, conversationId: string, title: string): Promise<void> {
    await httpsCallable(functions, ASSISTANT_CONVERSATION_FUNCTION)({ tenantId, conversationId, action: 'rename', title });
  }

  async deleteConversation(tenantId: string, conversationId: string): Promise<void> {
    await httpsCallable(functions, ASSISTANT_CONVERSATION_FUNCTION)({ tenantId, conversationId, action: 'delete' });
  }
}
