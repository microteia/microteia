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

type ToolCallPart = Extract<ChatPart, { type: 'tool_call' }>;

/**
 * Toda chamada do assistente com EXATAMENTE um resultado, logo na mensagem seguinte e à frente de
 * qualquer texto — a única forma que os cinco provedores aceitam.
 *
 * Roda sobre o que vai ser ENVIADO, e não sobre o que foi carregado: a chamada que esperava aprovação
 * termina o histórico gravado sem resultado, e o resultado verdadeiro só chega quando a retomada a
 * executa. Fechar o par na carga punha um `interrupted` falso na frente do verdadeiro, e a OpenAI
 * recusava o segundo `tool` do mesmo id — depois de a escrita já ter acontecido.
 *
 * O resultado sem chamada à frente (a compactação engoliu o pedido que esperava aprovação) vira texto:
 * descartá-lo esconderia do modelo que a escrita aprovada rodou, e ele a repetiria.
 */
export const pairToolResults = (messages: ChatMessage[]): ChatMessage[] => {
  const out: ChatMessage[] = [];
  messages.forEach((message, index) => {
    const previous = messages[index - 1];
    const expected = new Set(
      message.role === 'user' && previous?.role === 'assistant'
        ? previous.parts.flatMap((part) => (part.type === 'tool_call' ? [part.id] : []))
        : [],
    );
    if (message.role === 'user') {
      const answered = new Set<string>();
      const results: ChatPart[] = [];
      const rest: ChatPart[] = [];
      for (const part of message.parts) {
        if (part.type !== 'tool_result') {
          rest.push(part);
        } else if (!expected.has(part.callId)) {
          rest.push({ type: 'text', text: `[Result of an earlier tool call${part.isError ? ' (error)' : ''}]\n${part.content}` });
        } else if (!answered.has(part.callId)) {
          answered.add(part.callId);
          results.push(part);
        }
      }
      const missing: ChatPart[] = [...expected]
        .filter((id) => !answered.has(id))
        .map((id) => ({ type: 'tool_result', callId: id, content: INTERRUPTED_RESULT, isError: true }));
      out.push({ role: 'user', parts: [...results, ...missing, ...rest] });
      return;
    }
    out.push(message);
    const calls = message.parts.filter((part): part is ToolCallPart => part.type === 'tool_call');
    if (calls.length > 0 && messages[index + 1]?.role !== 'user') {
      out.push({
        role: 'user',
        parts: calls.map((call) => ({ type: 'tool_result', callId: call.id, content: INTERRUPTED_RESULT, isError: true })),
      });
    }
  });
  return out;
};

/** As mensagens como vão ao provedor: vizinhas do mesmo papel fundidas e todo par de ferramenta fechado. */
export const toModelMessages = (history: ChatMessage[]): ChatMessage[] => pairToolResults(mergeConsecutive(history));

/**
 * O histórico que o modelo vê, a partir do que está gravado. A tela mostra os mesmos registros; o
 * modelo só precisa do rótulo do resumo. O par de ferramenta NÃO é fechado aqui — ver `pairToolResults`.
 */
export const toModelHistory = (records: AssistantMessageRecord[]): ChatMessage[] =>
  records.map((record) => {
    if (record.kind !== 'summary') return { role: record.role, parts: record.parts };
    const text = record.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('\n');
    return { role: 'user', parts: [{ type: 'text', text: `${SUMMARY_LABEL}\n${text}` }] };
  });

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
