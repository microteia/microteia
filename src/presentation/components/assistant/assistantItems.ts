import type {
  AssistantConversationStatus,
  AssistantMessageRecord,
  AssistantPendingCall,
  AssistantStreamChunk,
} from '../../../domain/schema/assistant/assistantConversation';

export type AssistantToolStatus = 'running' | 'done' | 'failed' | 'declined' | 'awaiting';

/** O que a conversa mostra, já desmontado em itens de tela. */
export type AssistantItem =
  | { kind: 'user'; id: string; text: string }
  | { kind: 'assistant'; id: string; markdown: string; interrupted: boolean; streaming: boolean }
  | { kind: 'tool'; id: string; name: string; status: AssistantToolStatus; input: string }
  | { kind: 'summary'; id: string; markdown: string };

/**
 * O que chegou pelo stream e ainda não está nas mensagens gravadas.
 *
 * O texto vem em SEGMENTOS: o pedaço `saved` dá ao segmento corrente o `seq` com que ele foi gravado,
 * e ele continua na tela até o Firestore entregar aquela mensagem. Sem isso, o texto sumiria entre o
 * `saved` e o snapshot — um piscar a cada resposta.
 */
export interface AssistantDraft {
  segments: Array<{ seq: number | null; text: string }>;
  tools: Record<string, AssistantToolStatus>;
  /** A pergunta enviada, até ela aparecer gravada. */
  pendingUser: string | null;
}

export const EMPTY_DRAFT: AssistantDraft = { segments: [], tools: {}, pendingUser: null };

export const applyAssistantChunk = (draft: AssistantDraft, chunk: AssistantStreamChunk): AssistantDraft => {
  switch (chunk.t) {
    case 'text': {
      const last = draft.segments[draft.segments.length - 1];
      if (last && last.seq === null) {
        return { ...draft, segments: [...draft.segments.slice(0, -1), { seq: null, text: last.text + chunk.d }] };
      }
      return { ...draft, segments: [...draft.segments, { seq: null, text: chunk.d }] };
    }
    case 'saved': {
      const last = draft.segments[draft.segments.length - 1];
      if (!last || last.seq !== null) return draft;
      return { ...draft, segments: [...draft.segments.slice(0, -1), { seq: chunk.seq, text: last.text }] };
    }
    case 'tool':
      return {
        ...draft,
        tools: {
          ...draft.tools,
          [chunk.id]: chunk.phase === 'start' ? 'running' : chunk.ok ? 'done' : 'failed',
        },
      };
    default:
      return draft;
  }
};

const DECLINED_MARK = '"declined":true';

const resultStatus = (content: string, isError: boolean): AssistantToolStatus => {
  if (!isError) return 'done';
  return content.includes(DECLINED_MARK) ? 'declined' : 'failed';
};

const prettyInput = (input: Record<string, unknown>): string => {
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return '';
  }
};

export interface AssistantItemsInput {
  records: AssistantMessageRecord[];
  draft: AssistantDraft;
  status: AssistantConversationStatus;
  pendingCalls: AssistantPendingCall[];
  busy: boolean;
}

/**
 * As mensagens gravadas mais o rascunho do stream, como a tela as mostra: a pergunta, a resposta em
 * Markdown, cada ferramenta como um cartão com o estado dela, e o resumo de uma compactação.
 */
export const buildAssistantItems = ({ records, draft, status, pendingCalls, busy }: AssistantItemsInput): AssistantItem[] => {
  const results = new Map<string, AssistantToolStatus>();
  for (const record of records) {
    for (const part of record.parts) {
      if (part.type === 'tool_result') results.set(part.callId, resultStatus(part.content, part.isError));
    }
  }
  const awaiting = new Set(
    status === 'awaiting-approval' ? pendingCalls.filter((call) => call.needsApproval).map((call) => call.id) : [],
  );

  const items: AssistantItem[] = [];
  for (const record of records) {
    if (record.kind === 'summary') {
      const text = record.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('\n');
      items.push({ kind: 'summary', id: `s${record.seq}`, markdown: text });
      continue;
    }
    record.parts.forEach((part, index) => {
      const id = `${record.seq}-${index}`;
      if (part.type === 'text' && part.text) {
        items.push(record.role === 'user'
          ? { kind: 'user', id, text: part.text }
          : { kind: 'assistant', id, markdown: part.text, interrupted: !!record.interrupted, streaming: false });
      } else if (part.type === 'tool_call') {
        const live = draft.tools[part.id];
        const toolStatus: AssistantToolStatus = results.get(part.id)
          ?? (awaiting.has(part.id) ? 'awaiting' : live ?? (busy ? 'running' : 'failed'));
        items.push({ kind: 'tool', id: part.id, name: part.name, status: toolStatus, input: prettyInput(part.input) });
      }
    });
  }

  const savedSeqs = new Set(records.map((record) => record.seq));
  const userSeen = draft.pendingUser !== null && records.some((record) =>
    record.role === 'user' && record.parts.some((part) => part.type === 'text' && part.text === draft.pendingUser));
  if (draft.pendingUser !== null && !userSeen) {
    items.push({ kind: 'user', id: 'pending-user', text: draft.pendingUser });
  }
  draft.segments.forEach((segment, index) => {
    if (!segment.text || (segment.seq !== null && savedSeqs.has(segment.seq))) return;
    items.push({
      kind: 'assistant',
      id: `draft-${index}`,
      markdown: segment.text,
      interrupted: false,
      streaming: segment.seq === null && busy,
    });
  });
  return items;
};

export type AssistantSlashCommand = 'new' | 'compact' | 'help';

export const ASSISTANT_SLASH_COMMANDS: readonly AssistantSlashCommand[] = ['new', 'compact', 'help'];

const ALIASES: Record<string, AssistantSlashCommand> = { new: 'new', clear: 'new', compact: 'compact', help: 'help' };

/**
 * `/new`, `/clear`, `/compact`, `/help`. Devolve `null` quando o texto não é comando — inclusive uma
 * frase que só COMEÇA com barra e tem espaço depois ("/ ou -"), que é pergunta, não comando.
 */
export const parseSlashCommand = (text: string): { command: AssistantSlashCommand | null; name: string } | null => {
  const trimmed = text.trim();
  const match = /^\/([a-z-]+)$/i.exec(trimmed);
  if (!match) return null;
  const name = match[1].toLowerCase();
  return { command: ALIASES[name] ?? null, name };
};
