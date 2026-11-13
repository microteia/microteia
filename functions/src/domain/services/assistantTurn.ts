import type {
  ChatEvent,
  ChatMessage,
  ChatPart,
  ChatRequest,
  ChatTool,
} from '../repositories/IAIChatProviderService';
import type {
  AssistantMessageRecord,
  AssistantPendingCall,
  AssistantStreamChunk,
} from '../schema/assistant/assistantConversation';
import { ASSISTANT_TOOL_RESULT_MAX_CHARS } from '../schema/assistant/assistantConversation';
import { COMPACTION_REQUEST, COMPACTION_SYSTEM_PROMPT } from './assistantPrompt';
import { mergeConsecutive, transcriptOf } from './assistantHistory';

/** O que a pessoa recusou volta ao modelo como resultado com erro — ele precisa saber que não rodou. */
const DECLINED_RESULT = JSON.stringify({ declined: true, reason: 'declined-by-user' });

export interface AssistantToolOutcome {
  content: string;
  isError: boolean;
}

export interface AssistantTurnDeps {
  /** O provedor de `ai.chat` já ligado à credencial do escritório. */
  chat: (request: ChatRequest, signal: AbortSignal) => AsyncIterable<ChatEvent>;
  system: string;
  tools: ChatTool[];
  /** Se a chamada desta ferramenta precisa da decisão da pessoa antes de rodar. */
  needsApproval: (toolName: string) => boolean;
  runTool: (name: string, input: Record<string, unknown>) => Promise<AssistantToolOutcome>;
  /** Grava a mensagem e devolve o `seq` dela. */
  append: (message: Omit<AssistantMessageRecord, 'seq' | 'createdAt'>) => Promise<number>;
  emit: (chunk: AssistantStreamChunk) => void;
  signal: AbortSignal;
  maxSteps: number;
}

export interface AssistantTurnStart {
  history: ChatMessage[];
  userText?: string;
  /** A retomada depois de um pedido de aprovação: as chamadas que esperavam, e o que a pessoa decidiu. */
  resume?: { pending: AssistantPendingCall[]; approvals: Record<string, boolean> };
}

export interface AssistantTurnOutcome {
  status: 'idle' | 'awaiting-approval';
  pendingCalls: AssistantPendingCall[];
  /** `null` quando nenhuma chamada ao modelo terminou nesta pergunta. */
  lastInputTokens: number | null;
}

const clip = (text: string): string =>
  text.length <= ASSISTANT_TOOL_RESULT_MAX_CHARS ? text : `${text.slice(0, ASSISTANT_TOOL_RESULT_MAX_CHARS)}…`;

const toolCallsOf = (message: ChatMessage): Extract<ChatPart, { type: 'tool_call' }>[] =>
  message.parts.filter((part): part is Extract<ChatPart, { type: 'tool_call' }> => part.type === 'tool_call');

const withoutToolCalls = (message: ChatMessage): ChatMessage => ({
  role: message.role,
  parts: message.parts.filter((part) => part.type !== 'tool_call'),
});

const executeCalls = async (
  deps: AssistantTurnDeps,
  calls: AssistantPendingCall[],
  approvals: Record<string, boolean>,
): Promise<ChatPart[]> => {
  const results: ChatPart[] = [];
  for (const call of calls) {
    if (call.needsApproval && approvals[call.id] !== true) {
      results.push({ type: 'tool_result', callId: call.id, content: DECLINED_RESULT, isError: true });
      deps.emit({ t: 'tool', id: call.id, name: call.name, phase: 'end', ok: false });
      continue;
    }
    deps.emit({ t: 'tool', id: call.id, name: call.name, phase: 'start' });
    const outcome = await deps.runTool(call.name, call.input);
    results.push({ type: 'tool_result', callId: call.id, content: clip(outcome.content), isError: outcome.isError });
    deps.emit({ t: 'tool', id: call.id, name: call.name, phase: 'end', ok: !outcome.isError });
  }
  return results;
};

/**
 * Uma pergunta, do texto da pessoa até a resposta final — passando por quantas voltas de ferramenta
 * forem precisas, até `maxSteps`.
 *
 * Toda mensagem é gravada ASSIM que termina, e não no fim da pergunta: a pessoa que fecha a aba no
 * meio de uma busca longa encontra, ao voltar, tudo o que já tinha acontecido. Pela mesma razão o
 * aborto não perde o que chegou — o texto parcial é gravado marcado como interrompido.
 *
 * Uma chamada de escrita que pede aprovação ENCERRA a pergunta: a decisão chega numa chamada nova, e
 * nenhuma function fica parada esperando um clique que pode não vir.
 */
export const runAssistantTurn = async (
  deps: AssistantTurnDeps,
  start: AssistantTurnStart,
): Promise<AssistantTurnOutcome> => {
  const history = [...start.history];
  let lastInputTokens: number | null = null;
  const idle = (): AssistantTurnOutcome => ({ status: 'idle', pendingCalls: [], lastInputTokens });

  const save = async (message: ChatMessage, interrupted = false): Promise<void> => {
    if (message.parts.length === 0) return;
    const seq = await deps.append({
      role: message.role,
      kind: 'message',
      parts: message.parts,
      ...(interrupted ? { interrupted: true } : {}),
    });
    deps.emit({ t: 'saved', seq });
    history.push(message);
  };

  if (start.resume && start.resume.pending.length > 0) {
    await save({ role: 'user', parts: await executeCalls(deps, start.resume.pending, start.resume.approvals) });
  }
  if (start.userText) await save({ role: 'user', parts: [{ type: 'text', text: start.userText }] });
  if (deps.signal.aborted) return idle();

  for (let step = 0; step < deps.maxSteps; step += 1) {
    let streamed = '';
    let done: Extract<ChatEvent, { type: 'done' }> | null = null;
    try {
      for await (const event of deps.chat({ system: deps.system, messages: mergeConsecutive(history), tools: deps.tools }, deps.signal)) {
        if (event.type === 'text') {
          streamed += event.delta;
          deps.emit({ t: 'text', d: event.delta });
        } else {
          done = event;
        }
      }
    } catch (error) {
      if (!deps.signal.aborted) throw error;
    }

    if (!done) {
      // Sem `done` só se chega abortando — ou com um provedor que fechou o stream no meio.
      await save({ role: 'assistant', parts: streamed ? [{ type: 'text', text: streamed }] : [] }, true);
      deps.emit({ t: 'notice', message: '@core.assistant/notice.interrupted' });
      return idle();
    }

    if (done.usage) lastInputTokens = done.usage.inputTokens;

    if (done.stop === 'refused' || done.stop === 'max_tokens') {
      // A chamada cortada pode ter argumentos pela metade: nenhuma roda, e nenhuma fica no histórico
      // sem resultado.
      await save(withoutToolCalls(done.message));
      deps.emit({ t: 'notice', message: done.stop === 'refused' ? '@core.assistant/notice.refused' : '@core.assistant/notice.truncated' });
      return idle();
    }

    const calls = toolCallsOf(done.message);
    await save(done.message);
    if (calls.length === 0) return idle();

    const pending: AssistantPendingCall[] = calls.map((call) => ({
      id: call.id,
      name: call.name,
      input: call.input,
      needsApproval: deps.needsApproval(call.name),
    }));
    if (pending.some((call) => call.needsApproval)) {
      deps.emit({ t: 'approval', calls: pending });
      return { status: 'awaiting-approval', pendingCalls: pending, lastInputTokens };
    }

    await save({ role: 'user', parts: await executeCalls(deps, pending, {}) });
    if (deps.signal.aborted) return idle();
  }

  deps.emit({ t: 'notice', message: '@core.assistant/notice.max-steps', params: { count: String(deps.maxSteps) } });
  return idle();
};

/**
 * O resumo da conversa, pelo mesmo provedor e sem ferramentas. Devolve `''` quando o modelo não
 * respondeu nada — quem chama mantém a conversa como estava.
 */
export const summarizeConversation = async (
  chat: AssistantTurnDeps['chat'],
  history: ChatMessage[],
  signal: AbortSignal,
): Promise<string> => {
  const transcript = transcriptOf(history);
  if (!transcript) return '';
  let summary = '';
  for await (const event of chat(
    {
      system: COMPACTION_SYSTEM_PROMPT,
      tools: [],
      messages: [{ role: 'user', parts: [{ type: 'text', text: `${COMPACTION_REQUEST}\n\n${transcript}` }] }],
    },
    signal,
  )) {
    if (event.type === 'text') summary += event.delta;
  }
  return summary.trim();
};
