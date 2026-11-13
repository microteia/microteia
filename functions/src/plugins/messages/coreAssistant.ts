// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/plugins/messages/coreAssistant.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

/** Os textos do assistente de IA do workspace: a conversa, os avisos e as recusas do backend. */
export const CORE_ASSISTANT_MESSAGES: Record<string, string> = {
  'error.not-enabled': 'The AI assistant is not enabled in this organization.',
  'error.provider-unsupported': 'The configured AI connection ({provider}) cannot hold a conversation.',
  'error.provider': 'The AI provider returned an error: {detail}',
  'error.busy': 'This conversation is still answering. Wait for it to finish, or stop it, and try again.',
  'error.not-found': 'Conversation not found.',
  'error.invalid-request': 'The request to the assistant is incomplete.',
  'error.message-too-long': 'The message is too long — {max} characters at most.',
  'error.title-invalid': 'The title must have between 1 and {max} characters.',
  'error.nothing-pending': 'There is nothing waiting for your approval in this conversation.',
  'error.nothing-to-compact': 'There is nothing to summarize yet.',

  'notice.max-steps': 'The assistant stopped after {count} steps. Ask it to continue if there is more to do.',
  'notice.truncated': 'The answer reached the size limit of the AI connection and was cut short.',
  'notice.refused': 'The AI declined to answer this request.',
  'notice.compacted': 'The earlier part of the conversation was summarized to keep it within the configured size.',
  'notice.interrupted': 'The answer was stopped before it finished.',
};
