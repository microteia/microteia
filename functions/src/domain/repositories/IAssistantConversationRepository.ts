import type {
  AssistantConversationRecord,
  AssistantMessageRecord,
} from '../schema/assistant/assistantConversation';

export interface AssistantConversation extends AssistantConversationRecord {
  id: string;
}

/**
 * O resultado de tomar a conversa para uma pergunta. `busy` é a outra aba (ou a pergunta anterior,
 * ainda viva) — e a trava vencida não conta: uma instância que morreu no meio solta a conversa sozinha.
 */
export type AssistantLease =
  | { ok: true; conversation: AssistantConversation }
  | { ok: false; reason: 'not-found' | 'busy' };

export interface IAssistantConversationRepository {
  /** Cria a conversa já travada para a pergunta que a abriu. */
  create(tenantId: string, ownerId: string, title: string, now: number): Promise<AssistantConversation>;
  /** Trava a conversa da pessoa, numa transação. A conversa de outra pessoa responde `not-found`. */
  acquire(tenantId: string, conversationId: string, ownerId: string, now: number): Promise<AssistantLease>;
  get(tenantId: string, conversationId: string): Promise<AssistantConversation | null>;
  /** As mensagens a partir de `fromSeq`, em ordem, até `limit`. */
  loadMessages(tenantId: string, conversationId: string, fromSeq: number, limit: number): Promise<AssistantMessageRecord[]>;
  appendMessage(tenantId: string, conversationId: string, message: AssistantMessageRecord): Promise<void>;
  update(tenantId: string, conversationId: string, patch: Partial<AssistantConversationRecord>): Promise<void>;
  /** Apaga a conversa e TODAS as mensagens dela. */
  remove(tenantId: string, conversationId: string): Promise<void>;
}
