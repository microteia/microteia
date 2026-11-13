import type { AICredentials } from '../entities/AICredentials';
import type { AssistantPart } from '../schema/assistant/assistantConversation';

/**
 * Uma parte de mensagem de conversa, no formato NEUTRO do kernel. Cada provedor traduz de e para o
 * dele — é o que deixa o laço do assistente e a gravação da conversa sem saber qual IA respondeu.
 * É o mesmo tipo que a conversa grava (`AssistantPart`): a próxima pergunta reenvia o histórico
 * sem tradução nenhuma.
 *
 * `opaque` existe porque alguns provedores exigem de volta, intacto, um pedaço que só eles entendem:
 * o bloco de raciocínio assinado da Anthropic precisa voltar antes do `tool_use` que ele precedeu,
 * senão a chamada seguinte é recusada. O kernel guarda e devolve sem olhar dentro, e o provedor
 * descarta o que não for dele (`provider`), porque a conversa pode trocar de conexão no meio.
 */
export type ChatPart = AssistantPart;

export interface ChatMessage {
  role: 'user' | 'assistant';
  parts: ChatPart[];
}

export interface ChatTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ChatRequest {
  system: string;
  messages: ChatMessage[];
  tools: ChatTool[];
}

export type ChatStopReason = 'end' | 'tool_use' | 'max_tokens' | 'refused';

export interface ChatUsage {
  /** Tudo o que entrou na chamada — inclusive o que veio do cache —, porque é isso que mede a janela. */
  inputTokens: number;
  outputTokens: number;
}

/**
 * O que o provedor emite enquanto responde. O texto vem em pedaços para a tela; a mensagem inteira
 * vem uma vez, no fim, já MONTADA pelo provedor — só ele sabe em que ordem os blocos dele precisam
 * voltar na próxima chamada.
 */
export type ChatEvent =
  | { type: 'text'; delta: string }
  | { type: 'done'; message: ChatMessage; stop: ChatStopReason; usage: ChatUsage | null };

export interface IAIChatProviderService {
  canHandle(provider: string): boolean;
  stream(credentials: AICredentials, request: ChatRequest, signal: AbortSignal): AsyncIterable<ChatEvent>;
}
