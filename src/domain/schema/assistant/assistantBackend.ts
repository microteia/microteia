/**
 * As Cloud Functions do assistente de IA.
 *
 * Os nomes moram aqui pelo mesmo motivo de `agentBackend.ts`: são o contrato entre o
 * `functions/src/index.ts` que as exporta, o `manifest.backend.functions` da extensão que as
 * reivindica, o portão que pergunta se alguma extensão instalada as reivindica, e a tela que só
 * mostra o painel quando a function está no ar.
 */
export const ASSISTANT_CHAT_FUNCTION = 'assistantChat';
export const ASSISTANT_CONVERSATION_FUNCTION = 'assistantConversation';

export const ASSISTANT_BACKEND_FUNCTIONS: readonly string[] = [
  ASSISTANT_CHAT_FUNCTION,
  ASSISTANT_CONVERSATION_FUNCTION,
];
