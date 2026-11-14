import type {
  AssistantConversationRecord,
  AssistantMessageRecord,
  AssistantStreamChunk,
  AssistantTurnRequest,
  AssistantTurnResult,
} from '../schema/assistant/assistantConversation';

export interface AssistantConversation extends AssistantConversationRecord {
  id: string;
}

export interface IAssistantRepository {
  /** As conversas da pessoa, mais recente primeiro. */
  subscribeConversations(
    tenantId: string,
    userId: string,
    limit: number,
    onChange: (conversations: AssistantConversation[]) => void,
  ): () => void;
  /** As últimas `limit` mensagens de uma conversa, em ordem. */
  subscribeMessages(
    tenantId: string,
    conversationId: string,
    limit: number,
    onChange: (messages: AssistantMessageRecord[]) => void,
  ): () => void;
  /** Uma pergunta, com os pedaços entregues a `onChunk` enquanto chegam. Abortar o sinal para a resposta. */
  sendTurn(
    request: AssistantTurnRequest,
    onChunk: (chunk: AssistantStreamChunk) => void,
    signal: AbortSignal,
  ): Promise<AssistantTurnResult>;
  renameConversation(tenantId: string, conversationId: string, title: string): Promise<void>;
  deleteConversation(tenantId: string, conversationId: string): Promise<void>;
}
