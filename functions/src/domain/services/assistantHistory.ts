import type { ChatMessage, ChatPart } from '../repositories/IAIChatProviderService';
import type { AssistantMessageRecord } from '../schema/assistant/assistantConversation';

/**
 * O resumo entra na conversa como fala do USUÁRIO, porque é o único papel que todo provedor aceita
 * abrindo uma conversa. O rótulo diz ao modelo o que aquilo é — sem ele, o resumo seria lido como
 * uma pergunta.
 */
const SUMMARY_LABEL = '[Summary of the earlier part of this conversation]';

/**
 * Uma chamada sem resultado faz a próxima pergunta ser recusada por qualquer provedor. Acontece quando
 * a instância morreu entre a resposta do modelo e a execução da ferramenta: o histórico ficou com o
 * pedido e sem a resposta. Este é o resultado que fecha o par.
 */
const INTERRUPTED_RESULT = JSON.stringify({ interrupted: true });

/** Junta mensagens vizinhas do mesmo papel — resultado de ferramenta e pergunta nova caem lado a lado. */
export const mergeConsecutive = (messages: ChatMessage[]): ChatMessage[] => {
  const out: ChatMessage[] = [];
  for (const message of messages) {
    if (message.parts.length === 0) continue;
    const last = out[out.length - 1];
    if (last && last.role === message.role) {
      last.parts = [...last.parts, ...message.parts];
    } else {
      out.push({ role: message.role, parts: [...message.parts] });
    }
  }
  return out;
};

/** Toda chamada de ferramenta do assistente ganha um resultado logo na mensagem seguinte. */
export const repairToolPairs = (messages: ChatMessage[]): ChatMessage[] => {
  const out: ChatMessage[] = [];
  messages.forEach((message, index) => {
    out.push(message);
    if (message.role !== 'assistant') return;
    const calls = message.parts.filter((part): part is Extract<ChatPart, { type: 'tool_call' }> => part.type === 'tool_call');
    if (calls.length === 0) return;
    const next = messages[index + 1];
    const answered = new Set(
      next?.role === 'user'
        ? next.parts.flatMap((part) => (part.type === 'tool_result' ? [part.callId] : []))
        : [],
    );
    const missing: ChatPart[] = calls
      .filter((call) => !answered.has(call.id))
      .map((call) => ({ type: 'tool_result', callId: call.id, content: INTERRUPTED_RESULT, isError: true }));
    if (missing.length > 0) out.push({ role: 'user', parts: missing });
  });
  return out;
};

/**
 * O histórico que o modelo vê, a partir do que está gravado. A tela mostra os mesmos registros, mas
 * o modelo precisa de três ajustes que a tela não precisa: o rótulo do resumo, o par de toda chamada
 * fechado, e mensagens vizinhas do mesmo papel fundidas.
 */
export const toModelHistory = (records: AssistantMessageRecord[]): ChatMessage[] => {
  const messages: ChatMessage[] = records.map((record) => {
    if (record.kind !== 'summary') return { role: record.role, parts: record.parts };
    const text = record.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('\n');
    return { role: 'user', parts: [{ type: 'text', text: `${SUMMARY_LABEL}\n${text}` }] };
  });
  return mergeConsecutive(repairToolPairs(messages));
};

/** O corte de cada resultado de ferramenta dentro da transcrição que vai ser resumida. */
const TRANSCRIPT_TOOL_RESULT_CHARS = 2_000;

const clip = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max)}…`);

/**
 * A conversa como TEXTO corrido, para ser resumida. Texto, e não a estrutura de mensagens, porque a
 * compactação precisa funcionar em qualquer ponto — inclusive com uma chamada esperando aprovação,
 * que a estrutura de qualquer provedor recusaria sem o resultado.
 */
export const transcriptOf = (messages: ChatMessage[]): string =>
  messages
    .flatMap((message) =>
      message.parts.flatMap((part): string[] => {
        switch (part.type) {
          case 'text':
            return part.text ? [`${message.role === 'user' ? 'User' : 'Assistant'}: ${part.text}`] : [];
          case 'tool_call':
            return [`Assistant called ${part.name} ${JSON.stringify(part.input)}`];
          case 'tool_result':
            return [`Tool result${part.isError ? ' (error)' : ''}: ${clip(part.content, TRANSCRIPT_TOOL_RESULT_CHARS)}`];
          case 'opaque':
            return [];
        }
      }),
    )
    .join('\n\n');
