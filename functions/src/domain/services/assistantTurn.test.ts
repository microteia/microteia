import { describe, expect, it } from 'vitest';
import type { ChatEvent, ChatMessage, ChatRequest } from '../repositories/IAIChatProviderService';
import type { AssistantMessageRecord, AssistantStreamChunk } from '../schema/assistant/assistantConversation';
import type { AssistantTurnDeps } from './assistantTurn';
import { runAssistantTurn, summarizeConversation } from './assistantTurn';
import { mergeConsecutive, repairToolPairs, toModelHistory, transcriptOf } from './assistantHistory';
import { assistantSystemPrompt } from './assistantPrompt';

type Done = Extract<ChatEvent, { type: 'done' }>;

const reply = (text: string, extra: Partial<Done> = {}): ChatEvent[] => [
  ...(text ? [{ type: 'text' as const, delta: text }] : []),
  {
    type: 'done',
    message: { role: 'assistant', parts: text ? [{ type: 'text', text }] : [] },
    stop: 'end',
    usage: { inputTokens: 100, outputTokens: 10 },
    ...extra,
  },
];

const callTool = (id: string, name: string, input: Record<string, unknown> = {}): ChatEvent[] => [{
  type: 'done',
  message: { role: 'assistant', parts: [{ type: 'tool_call', id, name, input }] },
  stop: 'tool_use',
  usage: { inputTokens: 200, outputTokens: 5 },
}];

/** Um provedor de mentira que responde, em ordem, uma rodada por chamada, e guarda o que recebeu. */
const scripted = (rounds: ChatEvent[][]) => {
  const requests: ChatRequest[] = [];
  const chat = async function* (request: ChatRequest, signal: AbortSignal): AsyncIterable<ChatEvent> {
    requests.push(JSON.parse(JSON.stringify(request)) as ChatRequest);
    const round = rounds.shift() ?? reply('');
    for (const event of round) {
      if (signal.aborted) throw new DOMException('aborted', 'AbortError');
      yield event;
    }
  };
  return { chat, requests };
};

const harness = (rounds: ChatEvent[][], overrides: Partial<AssistantTurnDeps> = {}) => {
  const saved: Omit<AssistantMessageRecord, 'seq' | 'createdAt'>[] = [];
  const chunks: AssistantStreamChunk[] = [];
  const toolCalls: string[] = [];
  const { chat, requests } = scripted(rounds);
  const deps: AssistantTurnDeps = {
    chat,
    system: 'system',
    tools: [{ name: 'search_records', description: 'd', inputSchema: {} }],
    needsApproval: (name) => name === 'create_record',
    runTool: async (name) => {
      toolCalls.push(name);
      return { content: JSON.stringify({ ok: name }), isError: false };
    },
    append: async (message) => {
      saved.push(message);
      return saved.length - 1;
    },
    emit: (chunk) => chunks.push(chunk),
    signal: new AbortController().signal,
    maxSteps: 12,
    ...overrides,
  };
  return { deps, saved, chunks, toolCalls, requests };
};

describe('runAssistantTurn', () => {
  it('responde em streaming e grava a pergunta e a resposta', async () => {
    const h = harness([reply('Olá!')]);
    const outcome = await runAssistantTurn(h.deps, { history: [], userText: 'oi' });
    expect(outcome).toEqual({ status: 'idle', pendingCalls: [], lastInputTokens: 100 });
    expect(h.saved.map((message) => [message.role, message.parts])).toEqual([
      ['user', [{ type: 'text', text: 'oi' }]],
      ['assistant', [{ type: 'text', text: 'Olá!' }]],
    ]);
    expect(h.chunks).toEqual([{ t: 'saved', seq: 0 }, { t: 'text', d: 'Olá!' }, { t: 'saved', seq: 1 }]);
  });

  it('roda a ferramenta de leitura, devolve o resultado ao modelo e segue até a resposta', async () => {
    const h = harness([callTool('c1', 'search_records', { collection: 'x' }), reply('Achei 3.')]);
    await runAssistantTurn(h.deps, { history: [], userText: 'quantos?' });
    expect(h.toolCalls).toEqual(['search_records']);
    expect(h.requests[1].messages.at(-1)).toEqual({
      role: 'user',
      parts: [{ type: 'tool_result', callId: 'c1', content: '{"ok":"search_records"}', isError: false }],
    });
    expect(h.chunks).toContainEqual({ t: 'tool', id: 'c1', name: 'search_records', phase: 'start' });
    expect(h.chunks).toContainEqual({ t: 'tool', id: 'c1', name: 'search_records', phase: 'end', ok: true });
    expect(h.saved.at(-1)?.parts).toEqual([{ type: 'text', text: 'Achei 3.' }]);
  });

  it('escrita que pede aprovação encerra a pergunta sem rodar nada do lote', async () => {
    const h = harness([[{
      type: 'done',
      message: {
        role: 'assistant',
        parts: [
          { type: 'tool_call', id: 'r', name: 'search_records', input: {} },
          { type: 'tool_call', id: 'w', name: 'create_record', input: { collection: 'x' } },
        ],
      },
      stop: 'tool_use',
      usage: null,
    }]]);
    const outcome = await runAssistantTurn(h.deps, { history: [], userText: 'cadastre' });
    expect(outcome.status).toBe('awaiting-approval');
    expect(outcome.pendingCalls).toEqual([
      { id: 'r', name: 'search_records', input: {}, needsApproval: false },
      { id: 'w', name: 'create_record', input: { collection: 'x' }, needsApproval: true },
    ]);
    expect(h.toolCalls).toEqual([]);
    expect(h.chunks.at(-1)).toEqual({ t: 'approval', calls: outcome.pendingCalls });
  });

  it('na retomada, roda a aprovada e a de leitura, e devolve a recusada como recusa', async () => {
    const h = harness([reply('Feito.')]);
    await runAssistantTurn(h.deps, {
      history: [],
      resume: {
        pending: [
          { id: 'r', name: 'search_records', input: {}, needsApproval: false },
          { id: 'a', name: 'create_record', input: {}, needsApproval: true },
          { id: 'n', name: 'create_record', input: {}, needsApproval: true },
        ],
        approvals: { a: true, n: false },
      },
    });
    expect(h.toolCalls).toEqual(['search_records', 'create_record']);
    const results = h.saved[0].parts;
    expect(results.map((part) => part.type === 'tool_result' && [part.callId, part.isError])).toEqual([
      ['r', false],
      ['a', false],
      ['n', true],
    ]);
    expect(h.chunks).toContainEqual({ t: 'tool', id: 'n', name: 'create_record', phase: 'end', ok: false });
  });

  it('para no teto de passos e avisa', async () => {
    const h = harness(
      [callTool('1', 'search_records'), callTool('2', 'search_records'), callTool('3', 'search_records')],
      { maxSteps: 2 },
    );
    const outcome = await runAssistantTurn(h.deps, { history: [], userText: 'laço' });
    expect(outcome.status).toBe('idle');
    expect(h.toolCalls).toHaveLength(2);
    expect(h.chunks.at(-1)).toEqual({ t: 'notice', message: '@core.assistant/notice.max-steps', params: { count: '2' } });
  });

  it('corte por max_tokens não roda a chamada pela metade e não a deixa no histórico', async () => {
    const h = harness([[
      { type: 'text', delta: 'Vou ' },
      {
        type: 'done',
        message: { role: 'assistant', parts: [{ type: 'text', text: 'Vou ' }, { type: 'tool_call', id: 'x', name: 'search_records', input: {} }] },
        stop: 'max_tokens',
        usage: null,
      },
    ]]);
    await runAssistantTurn(h.deps, { history: [], userText: 'q' });
    expect(h.toolCalls).toEqual([]);
    expect(h.saved.at(-1)?.parts).toEqual([{ type: 'text', text: 'Vou ' }]);
    expect(h.chunks.at(-1)).toEqual({ t: 'notice', message: '@core.assistant/notice.truncated' });
  });

  it('abortar no meio grava o parcial marcado como interrompido', async () => {
    const controller = new AbortController();
    const h = harness([], {
      signal: controller.signal,
      chat: async function* () {
        yield { type: 'text', delta: 'Comecei' };
        controller.abort();
        throw new DOMException('aborted', 'AbortError');
      },
    });
    const outcome = await runAssistantTurn(h.deps, { history: [], userText: 'q' });
    expect(outcome.status).toBe('idle');
    expect(h.saved.at(-1)).toEqual({ role: 'assistant', kind: 'message', parts: [{ type: 'text', text: 'Comecei' }], interrupted: true });
    expect(h.chunks.at(-1)).toEqual({ t: 'notice', message: '@core.assistant/notice.interrupted' });
  });

  it('erro do provedor que não é aborto sobe para quem chamou', async () => {
    const h = harness([], {
      chat: async function* () {
        yield* [];
        throw new Error('quota');
      },
    });
    await expect(runAssistantTurn(h.deps, { history: [], userText: 'q' })).rejects.toThrow('quota');
  });

  it('pergunta nova depois de um resultado de ferramenta funde as falas vizinhas do usuário', async () => {
    const h = harness([reply('ok')]);
    const history: ChatMessage[] = [
      { role: 'assistant', parts: [{ type: 'tool_call', id: 'c', name: 'search_records', input: {} }] },
      { role: 'user', parts: [{ type: 'tool_result', callId: 'c', content: '{}', isError: false }] },
    ];
    await runAssistantTurn(h.deps, { history, userText: 'e agora?' });
    expect(h.requests[0].messages).toEqual([
      history[0],
      {
        role: 'user',
        parts: [
          { type: 'tool_result', callId: 'c', content: '{}', isError: false },
          { type: 'text', text: 'e agora?' },
        ],
      },
    ]);
  });
});

describe('histórico do modelo', () => {
  it('fecha a chamada sem resultado e rotula o resumo', () => {
    const records: AssistantMessageRecord[] = [
      { seq: 4, role: 'user', kind: 'summary', parts: [{ type: 'text', text: 'Resumo.' }], createdAt: 0 },
      { seq: 5, role: 'assistant', kind: 'message', parts: [{ type: 'tool_call', id: 'z', name: 'get_record', input: {} }], createdAt: 0 },
    ];
    const history = toModelHistory(records);
    expect(history[0].parts[0]).toEqual({ type: 'text', text: '[Summary of the earlier part of this conversation]\nResumo.' });
    expect(history[2]).toEqual({
      role: 'user',
      parts: [{ type: 'tool_result', callId: 'z', content: '{"interrupted":true}', isError: true }],
    });
  });

  it('não duplica o resultado que já existe', () => {
    const messages: ChatMessage[] = [
      { role: 'assistant', parts: [{ type: 'tool_call', id: 'a', name: 'x', input: {} }] },
      { role: 'user', parts: [{ type: 'tool_result', callId: 'a', content: '1', isError: false }] },
    ];
    expect(repairToolPairs(messages)).toEqual(messages);
  });

  it('descarta mensagem vazia ao fundir', () => {
    expect(mergeConsecutive([{ role: 'user', parts: [] }, { role: 'user', parts: [{ type: 'text', text: 'a' }] }]))
      .toEqual([{ role: 'user', parts: [{ type: 'text', text: 'a' }] }]);
  });

  it('a transcrição corta o resultado longo e ignora bloco opaco', () => {
    const text = transcriptOf([
      { role: 'user', parts: [{ type: 'text', text: 'Pergunta' }] },
      { role: 'assistant', parts: [{ type: 'opaque', provider: 'anthropic', block: {} }, { type: 'tool_call', id: '1', name: 'search_records', input: { q: 1 } }] },
      { role: 'user', parts: [{ type: 'tool_result', callId: '1', content: 'x'.repeat(5000), isError: false }] },
    ]);
    expect(text).toContain('User: Pergunta');
    expect(text).toContain('Assistant called search_records {"q":1}');
    expect(text.length).toBeLessThan(2200);
  });
});

describe('summarizeConversation', () => {
  it('resume pelo mesmo provedor, sem ferramentas, a partir da transcrição', async () => {
    const { chat, requests } = scripted([reply('- resumo')]);
    const summary = await summarizeConversation(chat, [{ role: 'user', parts: [{ type: 'text', text: 'oi' }] }], new AbortController().signal);
    expect(summary).toBe('- resumo');
    expect(requests[0].tools).toEqual([]);
    expect(requests[0].messages[0].parts[0]).toMatchObject({ type: 'text' });
  });

  it('conversa vazia não chama o provedor', async () => {
    const { chat, requests } = scripted([]);
    expect(await summarizeConversation(chat, [], new AbortController().signal)).toBe('');
    expect(requests).toHaveLength(0);
  });
});

describe('assistantSystemPrompt', () => {
  const base = { officeName: 'Acme', userName: 'Ana', locale: 'pt-BR', timeZone: 'America/Sao_Paulo', now: new Date('2026-11-13T12:00:00Z') };

  it('muda a regra de escrita conforme o modo e traz só a data', () => {
    const confirm = assistantSystemPrompt({ ...base, writeMode: 'confirm' });
    const off = assistantSystemPrompt({ ...base, writeMode: 'off' });
    expect(confirm).toContain('shown to the person for approval');
    expect(off).toContain('you can only read data');
    expect(confirm).toContain('Friday, November 13, 2026');
    expect(confirm).not.toMatch(/\d{1,2}:\d{2}/);
    expect(confirm).toContain('"pt-BR"');
  });

  it('fuso inválido cai na data ISO em vez de lançar', () => {
    expect(assistantSystemPrompt({ ...base, timeZone: 'Nowhere/Invalid', writeMode: 'auto' })).toContain('2026-11-13');
  });
});
