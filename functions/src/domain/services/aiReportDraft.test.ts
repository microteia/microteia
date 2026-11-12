import { describe, it, expect } from 'vitest';
import { draftReportSpec, schemaForReportDraft } from './aiReportDraft';
import { createSchemaContext } from '../schema/pathResolver';
import type { SchemaScreen } from '../schema/pathResolver';
import type { CallAIInput, CallAIUseCase } from '../usecases/CallAIUseCase';
import type { AICredentials } from '../entities/AICredentials';
import { hasBlockingReportIssue } from '../schema/report/validateReportSpec';

const faturas: SchemaScreen = {
  id: 'faturas',
  titleSingular: 'Fatura',
  titlePlural: 'Faturas',
  titleFieldKey: 'numero',
  fields: [
    { key: 'numero', label: 'Número', type: 'text', required: false, order: 0, origin: 'design' },
    { key: 'valor', label: 'Valor', type: 'currency', required: false, order: 1, origin: 'design' },
    { key: 'clienteId', label: 'Cliente', type: 'reference', refEntity: 'clientes', required: false, order: 2, origin: 'design' },
  ],
};
const schema = createSchemaContext([faturas], []);
const credentials: AICredentials = { provider: 'openai', apiKey: 'k', model: 'm', temperature: 0, maxTokens: 1000 };

const fakeAI = (answer: unknown): CallAIUseCase & { calls: CallAIInput[] } => {
  const calls: CallAIInput[] = [];
  return {
    calls,
    execute: async () => '',
    executeJson: async <T>(input: CallAIInput): Promise<T> => {
      calls.push(input);
      return answer as T;
    },
  };
};

const draft = (answer: unknown) => {
  const ai = fakeAI(answer);
  return { ai, run: () => draftReportSpec({ callAI: ai, credentials, description: 'total por número', schema, scanCeiling: 2000 }) };
};

describe('draftReportSpec', () => {
  it('o modelo recebe as telas com os campos e as referências', () => {
    expect(schemaForReportDraft(schema)).toBe('- faturas (Faturas): numero:text, valor:currency, clienteId:reference->clientes');
  });

  it('o spec proposto volta com o que o validador de sempre disse', async () => {
    const { ai, run } = draft({
      title: 'Faturas por número',
      spec: {
        v: 1,
        dataset: { table: 'faturas', dimensions: [{ key: 'numero', path: 'numero' }], measures: [{ key: 'total', op: 'sum', path: 'valor' }] },
        shape: { kind: 'summary', groupBy: [{ dimension: 'numero' }], values: ['total'] },
      },
    });
    const outcome = await run();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.draft.title).toBe('Faturas por número');
    expect(hasBlockingReportIssue(outcome.draft.issues)).toBe(false);
    expect(ai.calls[0].userContent).toContain('total por número');
  });

  it('campo que a tela não tem é recusa do validador — o rascunho não é aceito às cegas', async () => {
    const { run } = draft({
      spec: {
        v: 1,
        dataset: { table: 'faturas', dimensions: [{ key: 'x', path: 'naoExiste' }], measures: [] },
        shape: { kind: 'tabular', columns: ['x'] },
      },
    });
    const outcome = await run();
    expect(outcome.ok && hasBlockingReportIssue(outcome.draft.issues)).toBe(true);
  });

  it('o modelo que recusa, ou não devolve spec, vira mensagem', async () => {
    expect(await draft({ error: 'não há tabela de vendas' }).run())
      .toEqual({ ok: false, error: '@core.reports/draft.refused', detail: 'não há tabela de vendas' });
    expect(await draft({ title: 'x' }).run()).toEqual({ ok: false, error: '@core.reports/draft.no-spec' });
  });
});
