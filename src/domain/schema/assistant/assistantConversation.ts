/**
 * O assistente de IA do workspace: a conversa que uma pessoa tem com a conexão de IA do escritório,
 * usando as ferramentas do agente com as permissões DELA.
 *
 * Este arquivo é o contrato entre a function que conduz a conversa e a tela que a mostra — o formato
 * gravado no Firestore e o protocolo dos pedaços que viajam em streaming. Fica no schema
 * compartilhado porque os dois lados precisam concordar byte a byte, e um campo renomeado de um lado
 * só não falha em lugar nenhum: a mensagem simplesmente some da tela.
 */

/** Coleção reservada do kernel, um documento por conversa, sob o escritório. */
export const ASSISTANT_CONVERSATIONS_COLLECTION = 'assistantConversations';
export const ASSISTANT_MESSAGES_SUBCOLLECTION = 'messages';

/** A permissão de conversar com o assistente. Declarada pela extensão que liga o recurso. */
export const ASSISTANT_USE_PERMISSION = 'assistant.use';

/**
 * O que acontece quando a IA quer GRAVAR — criar, alterar, apagar, disparar uma automação.
 * `confirm` para e pede aprovação; `auto` executa com as permissões da pessoa; `off` nem oferece as
 * ferramentas de escrita ao modelo, e o assistente vira consulta.
 */
export const ASSISTANT_WRITE_MODES = ['confirm', 'auto', 'off'] as const;
export type AssistantWriteMode = (typeof ASSISTANT_WRITE_MODES)[number];
export const ASSISTANT_DEFAULT_WRITE_MODE: AssistantWriteMode = 'confirm';
export const ASSISTANT_WRITE_MODE_SETTING = 'assistant.writeMode';

/**
 * O tamanho de conversa que o escritório aceita pagar, em tokens de entrada por chamada. Passou de
 * `ASSISTANT_COMPACT_RATIO` disso, a conversa é resumida antes da próxima pergunta. É ajuste, e não
 * a janela do modelo, porque a janela é teto técnico e o custo é decisão do escritório: um milhão de
 * tokens cabe, mas cada pergunta passaria a custar a conversa inteira.
 */
export const ASSISTANT_CONTEXT_TOKENS_SETTING = 'assistant.contextTokens';
export const ASSISTANT_DEFAULT_CONTEXT_TOKENS = 64_000;
export const ASSISTANT_MIN_CONTEXT_TOKENS = 8_000;
export const ASSISTANT_COMPACT_RATIO = 0.75;

/**
 * Quantas idas ao modelo uma pergunta pode custar. Cada volta de ferramenta é uma chamada paga e uma
 * espera na tela; um modelo que entra em laço não pode drenar a cota do escritório sem ninguém ver.
 */
export const ASSISTANT_MAX_STEPS = 12;

/**
 * O resultado de ferramenta guardado e reenviado ao modelo. Uma busca devolve até 200 registros: sem
 * corte, um único resultado ocuparia a conversa e voltaria a cada passo seguinte.
 */
export const ASSISTANT_TOOL_RESULT_MAX_CHARS = 16_000;

/** Uma pergunta, e não um documento colado: o documento entra pelo anexo, não pelo chat. */
export const ASSISTANT_MESSAGE_MAX_CHARS = 8_000;
export const ASSISTANT_TITLE_MAX_CHARS = 80;

/**
 * A trava de uma conversa enquanto a function conduz uma pergunta. Maior que o teto da function
 * (540 s), para que uma instância morta no meio solte a conversa sozinha logo depois.
 */
export const ASSISTANT_LEASE_MS = 600_000;

/** As conversas que a lista mostra. Antigas além disso ficam gravadas, só não aparecem. */
export const ASSISTANT_CONVERSATION_LIST_LIMIT = 30;

/**
 * As mensagens que a tela carrega de uma conversa, e o teto do que a function relê. Depois de uma
 * compactação, o modelo só vê o resumo e o que veio depois — este número protege só a conversa que
 * nunca foi compactada.
 */
export const ASSISTANT_MESSAGE_LOAD_LIMIT = 400;

/**
 * Uma parte de mensagem. O mesmo formato neutro que os provedores de `ai.chat` falam — ver
 * `IAIChatProviderService` —, gravado como veio para que a próxima pergunta reenvie a conversa sem
 * tradução nenhuma.
 */
export type AssistantPart =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; id: string; name: string; input: Record<string, unknown>; meta?: Record<string, unknown> }
  | { type: 'tool_result'; callId: string; content: string; isError: boolean }
  | { type: 'opaque'; provider: string; block: Record<string, unknown> };

/**
 * `summary` é o resumo de uma compactação: a partir dele o modelo deixa de ver o que veio antes,
 * mas a tela continua mostrando tudo.
 */
export type AssistantMessageKind = 'message' | 'summary';

export interface AssistantMessageRecord {
  seq: number;
  role: 'user' | 'assistant';
  kind: AssistantMessageKind;
  parts: AssistantPart[];
  /** A resposta foi cortada — a pessoa parou, ou a conexão caiu. O que chegou até ali fica. */
  interrupted?: boolean;
  createdAt: number;
}

export type AssistantConversationStatus = 'idle' | 'running' | 'awaiting-approval';

/** Uma chamada de ferramenta que espera a decisão da pessoa. */
export interface AssistantPendingCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  /** Só as de escrita pedem decisão; as de leitura do mesmo lote rodam junto na retomada. */
  needsApproval: boolean;
}

export interface AssistantConversationRecord {
  ownerId: string;
  title: string;
  status: AssistantConversationStatus;
  /** Epoch em ms. `null` fora de uma pergunta em andamento. */
  leaseUntil: number | null;
  pendingCalls: AssistantPendingCall[];
  /** O `seq` da primeira mensagem que o modelo vê — o resumo, depois de uma compactação. */
  contextStart: number;
  /** Os tokens de entrada da última chamada: é o que decide a compactação automática. */
  lastInputTokens: number;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

/** Os pedidos que a function aceita numa chamada. */
export interface AssistantTurnRequest {
  tenantId: string;
  /** Ausente = conversa nova. */
  conversationId?: string;
  message?: string;
  /** A decisão sobre as chamadas pendentes, por id: `true` aprova. */
  approvals?: Record<string, boolean>;
  command?: 'compact';
}

export interface AssistantTurnResult {
  conversationId: string;
  status: AssistantConversationStatus;
}

/**
 * Os pedaços que viajam em streaming durante uma pergunta. Nomes curtos de propósito: um por token de
 * texto, e o JSON de cada um cruza a rede.
 *
 * - `start`: a conversa em que a pergunta caiu (a nova, quando não havia).
 * - `text`: um pedaço da resposta em curso.
 * - `tool`: uma ferramenta começou ou terminou.
 * - `approval`: a pergunta parou esperando a decisão sobre estas chamadas.
 * - `compacting`: a conversa está sendo resumida antes de seguir.
 * - `saved`: a mensagem `seq` foi gravada — a tela troca o rascunho pela versão do Firestore.
 * - `notice`: um aviso do catálogo (`@namespace/chave`) sobre como a pergunta terminou.
 */
export type AssistantStreamChunk =
  | { t: 'start'; conversationId: string }
  | { t: 'text'; d: string }
  | { t: 'tool'; id: string; name: string; phase: 'start' | 'end'; ok?: boolean }
  | { t: 'approval'; calls: AssistantPendingCall[] }
  | { t: 'compacting' }
  | { t: 'saved'; seq: number }
  | { t: 'notice'; message: string; params?: Record<string, string> };

/** O id do documento de uma mensagem: o `seq` com zeros à esquerda, para a ordem do id ser a do `seq`. */
export const assistantMessageId = (seq: number): string => String(seq).padStart(6, '0');

export const isAssistantWriteMode = (value: unknown): value is AssistantWriteMode =>
  typeof value === 'string' && (ASSISTANT_WRITE_MODES as readonly string[]).includes(value);

export const assistantWriteMode = (value: unknown): AssistantWriteMode =>
  isAssistantWriteMode(value) ? value : ASSISTANT_DEFAULT_WRITE_MODE;

export const assistantContextTokens = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= ASSISTANT_MIN_CONTEXT_TOKENS
    ? Math.floor(value)
    : ASSISTANT_DEFAULT_CONTEXT_TOKENS;

/** O título nasce da primeira pergunta, sem chamada de IA: é de graça, e a pessoa renomeia se quiser. */
export const assistantTitleFrom = (message: string): string => {
  const line = message.replace(/\s+/g, ' ').trim();
  return line.length <= ASSISTANT_TITLE_MAX_CHARS ? line : `${line.slice(0, ASSISTANT_TITLE_MAX_CHARS - 1).trimEnd()}…`;
};
