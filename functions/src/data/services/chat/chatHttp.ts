import type { ChatMessage, ChatPart, ChatUsage } from '../../../domain/repositories/IAIChatProviderService';

/**
 * Teto de uma resposta em streaming. Nenhuma chamada de IA do backend tinha timeout: um provedor que
 * abre a conexão e para de mandar segurava a function até o limite dela, com a conversa travada.
 * Cinco minutos cobrem a resposta longa de um modelo que raciocina; o teto da TURNO é da function.
 */
export const CHAT_PROVIDER_TIMEOUT_MS = 300_000;

/**
 * Falha do provedor, com a mensagem DELE preservada. Ela chega ao usuário como parâmetro de uma
 * chave do catálogo — chave inválida, cota estourada, modelo inexistente são coisas que o escritório
 * resolve sozinho se ler o que o provedor disse.
 */
export class ChatProviderError extends Error {
  constructor(readonly status: number, readonly detail: string) {
    super(detail);
    this.name = 'ChatProviderError';
  }
}

const errorDetail = (body: unknown, status: number): string => {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    const nested = record.error;
    if (nested && typeof nested === 'object') {
      const message = (nested as Record<string, unknown>).message;
      if (typeof message === 'string' && message) return message;
    }
    if (typeof nested === 'string' && nested) return nested;
    if (typeof record.message === 'string' && record.message) return record.message;
  }
  return `HTTP ${status}`;
};

/** POST que devolve o corpo em streaming, com o aborto de quem chamou E o teto de tempo valendo juntos. */
export const postForStream = async (
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.any([signal, AbortSignal.timeout(CHAT_PROVIDER_TIMEOUT_MS)]),
  });
  if (!response.ok) {
    const parsed: unknown = await response.json().catch(() => null);
    throw new ChatProviderError(response.status, errorDetail(parsed, response.status));
  }
  if (!response.body) throw new ChatProviderError(response.status, `HTTP ${response.status}`);
  return response.body;
};

/** Erro que o provedor manda DENTRO do stream, depois do 200. */
export const streamError = (json: Record<string, unknown>): ChatProviderError =>
  new ChatProviderError(200, errorDetail(json, 200));

/**
 * Argumentos de ferramenta chegam como texto em pedaços. JSON inválido (corte por `max_tokens`, ou o
 * modelo errando) vira objeto vazio: a ferramenta recusa pela validação de entrada, a recusa volta
 * ao modelo, e ele tenta de novo — em vez de a turno inteira estourar.
 */
export const parseToolArguments = (raw: string): Record<string, unknown> => {
  if (!raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

/**
 * Monta a mensagem do assistente na ordem em que os blocos chegaram, juntando pedaços de texto
 * vizinhos. A ordem importa: a Anthropic recusa um `tool_use` cujo raciocínio assinado não volte
 * imediatamente antes dele.
 */
export class ChatMessageBuilder {
  private readonly parts: ChatPart[] = [];

  text(delta: string): void {
    if (!delta) return;
    const last = this.parts[this.parts.length - 1];
    if (last?.type === 'text') last.text += delta;
    else this.parts.push({ type: 'text', text: delta });
  }

  push(part: ChatPart): void {
    this.parts.push(part);
  }

  hasToolCalls(): boolean {
    return this.parts.some((part) => part.type === 'tool_call');
  }

  build(): ChatMessage {
    return { role: 'assistant', parts: this.parts.map((part) => ({ ...part })) };
  }
}

export const usageOf = (inputTokens: unknown, outputTokens: unknown): ChatUsage | null => {
  const input = typeof inputTokens === 'number' ? inputTokens : null;
  const output = typeof outputTokens === 'number' ? outputTokens : null;
  if (input === null && output === null) return null;
  return { inputTokens: input ?? 0, outputTokens: output ?? 0 };
};

/** Nome da ferramenta por id de chamada — Gemini e Cohere pedem o nome junto com o resultado. */
export const toolNamesById = (messages: ChatMessage[]): Map<string, string> => {
  const names = new Map<string, string>();
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type === 'tool_call') names.set(part.id, part.name);
    }
  }
  return names;
};

export const textOf = (parts: ChatPart[]): string =>
  parts.filter((part): part is Extract<ChatPart, { type: 'text' }> => part.type === 'text').map((part) => part.text).join('');
