import { describe, expect, it } from 'vitest';
import type { AssistantMessageRecord } from '../../../domain/schema/assistant/assistantConversation';
import { EMPTY_DRAFT, applyAssistantChunk, buildAssistantItems, parseSlashCommand } from './assistantItems';

const record = (seq: number, role: 'user' | 'assistant', parts: AssistantMessageRecord['parts'], extra: Partial<AssistantMessageRecord> = {}): AssistantMessageRecord =>
  ({ seq, role, kind: 'message', parts, createdAt: 0, ...extra });

const base = { status: 'idle' as const, pendingCalls: [], busy: false };

describe('applyAssistantChunk', () => {
  it('junta o texto no segmento aberto e o fecha com o seq gravado', () => {
    let draft = applyAssistantChunk(EMPTY_DRAFT, { t: 'text', d: 'Olá' });
    draft = applyAssistantChunk(draft, { t: 'text', d: ', Ana' });
    draft = applyAssistantChunk(draft, { t: 'saved', seq: 3 });
    draft = applyAssistantChunk(draft, { t: 'text', d: 'Depois' });
    expect(draft.segments).toEqual([{ seq: 3, text: 'Olá, Ana' }, { seq: null, text: 'Depois' }]);
  });

  it('saved sem texto aberto (a pergunta gravada) não cria segmento', () => {
    expect(applyAssistantChunk(EMPTY_DRAFT, { t: 'saved', seq: 0 })).toEqual(EMPTY_DRAFT);
  });

  it('acompanha o estado de cada ferramenta', () => {
    let draft = applyAssistantChunk(EMPTY_DRAFT, { t: 'tool', id: 'a', name: 'x', phase: 'start' });
    expect(draft.tools.a).toBe('running');
    draft = applyAssistantChunk(draft, { t: 'tool', id: 'a', name: 'x', phase: 'end', ok: false });
    expect(draft.tools.a).toBe('failed');
  });
});

describe('buildAssistantItems', () => {
  it('mostra a pergunta, a ferramenta com o resultado gravado e a resposta', () => {
    const items = buildAssistantItems({
      ...base,
      draft: EMPTY_DRAFT,
      records: [
        record(0, 'user', [{ type: 'text', text: 'Quantos?' }]),
        record(1, 'assistant', [
          { type: 'opaque', provider: 'anthropic', block: {} },
          { type: 'tool_call', id: 'c', name: 'search_records', input: { collection: 'x' } },
        ]),
        record(2, 'user', [{ type: 'tool_result', callId: 'c', content: '{}', isError: false }]),
        record(3, 'assistant', [{ type: 'text', text: 'Três.' }], { interrupted: true }),
      ],
    });
    expect(items.map((item) => [item.kind, item.kind === 'tool' ? item.status : null])).toEqual([
      ['user', null], ['tool', 'done'], ['assistant', null],
    ]);
    expect(items[2]).toMatchObject({ markdown: 'Três.', interrupted: true, streaming: false });
  });

  it('recusa da pessoa vira estado próprio, e a chamada pendente espera aprovação', () => {
    const items = buildAssistantItems({
      ...base,
      status: 'awaiting-approval',
      pendingCalls: [{ id: 'w', name: 'create_record', input: {}, needsApproval: true }],
      draft: EMPTY_DRAFT,
      records: [
        record(0, 'assistant', [{ type: 'tool_call', id: 'n', name: 'delete_record', input: {} }]),
        record(1, 'user', [{ type: 'tool_result', callId: 'n', content: '{"declined":true}', isError: true }]),
        record(2, 'assistant', [{ type: 'tool_call', id: 'w', name: 'create_record', input: {} }]),
      ],
    });
    expect(items.map((item) => item.kind === 'tool' && item.status)).toEqual(['declined', 'awaiting']);
  });

  it('o rascunho fica até o Firestore entregar a mensagem com aquele seq', () => {
    const draft = { segments: [{ seq: 1, text: 'Resposta' }], tools: {}, pendingUser: 'Oi' };
    const before = buildAssistantItems({ ...base, busy: true, draft, records: [] });
    expect(before.map((item) => item.kind)).toEqual(['user', 'assistant']);

    const after = buildAssistantItems({
      ...base,
      draft,
      records: [record(0, 'user', [{ type: 'text', text: 'Oi' }]), record(1, 'assistant', [{ type: 'text', text: 'Resposta' }])],
    });
    expect(after.map((item) => item.id)).toEqual(['0-0', '1-0']);
  });

  it('o segmento ainda aberto aparece como resposta em andamento', () => {
    const items = buildAssistantItems({ ...base, busy: true, draft: { ...EMPTY_DRAFT, segments: [{ seq: null, text: 'Escrev' }] }, records: [] });
    expect(items).toEqual([{ kind: 'assistant', id: 'draft-0', markdown: 'Escrev', interrupted: false, streaming: true }]);
  });

  it('o resumo de uma compactação vira item próprio', () => {
    const items = buildAssistantItems({
      ...base,
      draft: EMPTY_DRAFT,
      records: [record(5, 'user', [{ type: 'text', text: '- antes' }], { kind: 'summary' })],
    });
    expect(items).toEqual([{ kind: 'summary', id: 's5', markdown: '- antes' }]);
  });
});

describe('parseSlashCommand', () => {
  it('reconhece os comandos e o apelido', () => {
    expect(parseSlashCommand('/new')).toEqual({ command: 'new', name: 'new' });
    expect(parseSlashCommand(' /CLEAR ')).toEqual({ command: 'new', name: 'clear' });
    expect(parseSlashCommand('/compact')).toEqual({ command: 'compact', name: 'compact' });
  });

  it('comando desconhecido é reconhecido como comando, sem ação', () => {
    expect(parseSlashCommand('/foo')).toEqual({ command: null, name: 'foo' });
  });

  it('frase que começa com barra não é comando', () => {
    expect(parseSlashCommand('/ ou -')).toBeNull();
    expect(parseSlashCommand('quero /new')).toBeNull();
  });
});
