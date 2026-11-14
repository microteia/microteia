import type { AssistantConversation, IAssistantRepository } from '../../repositories/IAssistantRepository';
import type {
  AssistantMessageRecord,
  AssistantStreamChunk,
  AssistantTurnRequest,
  AssistantTurnResult,
} from '../../schema/assistant/assistantConversation';
import {
  ASSISTANT_CONVERSATION_LIST_LIMIT,
  ASSISTANT_MESSAGE_LOAD_LIMIT,
} from '../../schema/assistant/assistantConversation';

export type SubscribeToAssistantConversationsUseCase = {
  execute: (tenantId: string, userId: string, onChange: (conversations: AssistantConversation[]) => void) => () => void;
};

export const makeSubscribeToAssistantConversationsUseCase = (
  repo: IAssistantRepository,
): SubscribeToAssistantConversationsUseCase => ({
  execute: (tenantId, userId, onChange) =>
    repo.subscribeConversations(tenantId, userId, ASSISTANT_CONVERSATION_LIST_LIMIT, onChange),
});

export type SubscribeToAssistantMessagesUseCase = {
  execute: (tenantId: string, conversationId: string, onChange: (messages: AssistantMessageRecord[]) => void) => () => void;
};

export const makeSubscribeToAssistantMessagesUseCase = (
  repo: IAssistantRepository,
): SubscribeToAssistantMessagesUseCase => ({
  execute: (tenantId, conversationId, onChange) =>
    repo.subscribeMessages(tenantId, conversationId, ASSISTANT_MESSAGE_LOAD_LIMIT, onChange),
});

export type SendAssistantTurnUseCase = {
  execute: (
    request: AssistantTurnRequest,
    onChunk: (chunk: AssistantStreamChunk) => void,
    signal: AbortSignal,
  ) => Promise<AssistantTurnResult>;
};

export const makeSendAssistantTurnUseCase = (repo: IAssistantRepository): SendAssistantTurnUseCase => ({
  execute: (request, onChunk, signal) => repo.sendTurn(request, onChunk, signal),
});

export type RenameAssistantConversationUseCase = {
  execute: (tenantId: string, conversationId: string, title: string) => Promise<void>;
};

export const makeRenameAssistantConversationUseCase = (
  repo: IAssistantRepository,
): RenameAssistantConversationUseCase => ({
  execute: (tenantId, conversationId, title) => repo.renameConversation(tenantId, conversationId, title),
});

export type DeleteAssistantConversationUseCase = {
  execute: (tenantId: string, conversationId: string) => Promise<void>;
};

/** As mensagens vão junto — a callable apaga em cascata no servidor. */
export const makeDeleteAssistantConversationUseCase = (
  repo: IAssistantRepository,
): DeleteAssistantConversationUseCase => ({
  execute: (tenantId, conversationId) => repo.deleteConversation(tenantId, conversationId),
});
