import { describe, it, expect } from 'vitest';
import { draftLookupCollections, draftReportSpec, schemaForReportDraft } from './aiReportDraft';
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

/** Responde, em ordem, uma resposta por chamada; a última se repete. */
const fakeAI = (...answers: unknown[]): CallAIUseCase & { calls: CallAIInput[] } => {
  const calls: CallAIInput[] = [];
  return {
    calls,
    execute: async () => '',
    executeJson: async <T>(input: CallAIInput): Promise<T> => {
      calls.push(input);
      return answers[Math.min(calls.length - 1, answers.length - 1)] as T;
    },
  };
};

const draft = (answer: unknown) => {
  const ai = fakeAI(answer);
  return { ai, run: () => draftReportSpec({ callAI: ai, credentials, description: 'total por número', schema, scanCeiling: 2000 }) };
};

describe('draftReportSpec', () => {
  it('o modelo recebe as telas com os campos e as referências', () => {
    expect(schemaForReportDraft(schema)).toBe(
      '- faturas (Faturas): numero "Número":text, valor "Valor":currency, clienteId "Cliente":reference->clientes',
    );
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
        dataset: { table: 'faturas', dimensions: [{ key: 'x', path: 'naoExiste' }], measures: [{ key: 'count', op: 'count' }] },
        shape: { kind: 'tabular', columns: ['x'] },
      },
    });
    const outcome = await run();
    // O validador de sempre ACEITA o caminho que não conhece (dado de extensão); o modelo, que só viu os
    // campos declarados, não pode inventar um — é o rascunho que bloqueia.
    expect(outcome.ok && hasBlockingReportIssue(outcome.draft.issues)).toBe(true);
    expect(outcome.ok && outcome.draft.issues.map((issue) => issue.error)).toContain('@core.reports/draft.unknown-field');
  });

  it('o campo de lista vai com as opções, CHAVE=rótulo — é a chave que o filtro compara', () => {
    const comSituacao = createSchemaContext([{
      ...faturas,
      fields: [{
        key: 'status', label: 'Situação', type: 'select', required: false, order: 0, origin: 'design',
        options: [{ key: 'open', label: 'Em aberto' }, { key: 'paid', label: 'Paga' }],
      }],
    }], []);
    expect(schemaForReportDraft(comSituacao)).toBe('- faturas (Faturas): status "Situação":select[open=Em aberto|paid=Paga]');
  });

  it('a LISTA sem medida ganha a contagem, em vez de voltar reprovada por "sem número"', async () => {
    const { run } = draft({
      title: 'Faturas em aberto',
      spec: {
        v: 1,
        dataset: {
          table: 'faturas',
          where: [{ path: 'numero', op: 'exists' }],
          dimensions: [{ key: 'numero', path: 'numero' }],
        },
        shape: { kind: 'tabular', columns: ['numero'] },
      },
    });
    const outcome = await run();
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.draft.spec.dataset.measures).toEqual([{ key: 'count', op: 'count' }]);
    expect(hasBlockingReportIssue(outcome.draft.issues)).toBe(false);
  });

  it('a lista de OUTRA coleção é lida pelo servidor e chega ao modelo com as opções', () => {
    const comLista = createSchemaContext([{
      ...faturas,
      fields: [{ key: 'area', label: 'Área', type: 'select', lookupCollection: 'areas', required: false, order: 0, origin: 'design' }],
    }], []);
    expect(draftLookupCollections(comLista)).toEqual(['areas']);
    expect(schemaForReportDraft(comLista, new Map([['areas', [{ key: 'civ', label: 'Cível' }]]])))
      .toBe('- faturas (Faturas): area "Área":select[civ=Cível]');
  });

  describe('uma tentativa de correção', () => {
    const inventado = {
      title: 'Por x',
      spec: {
        v: 1,
        dataset: { table: 'faturas', dimensions: [{ key: 'x', path: 'naoExiste' }], measures: [{ key: 'count', op: 'count' }] },
        shape: { kind: 'tabular', columns: ['x'] },
      },
    };
    const corrigido = {
      title: 'Por número',
      spec: { ...inventado.spec, dataset: { ...inventado.spec.dataset, dimensions: [{ key: 'x', path: 'numero' }] } },
    };
    const run = (ai: CallAIUseCase, describeIssue?: (issue: { error: string }) => string) => draftReportSpec({
      callAI: ai, credentials, description: 'faturas', schema, scanCeiling: 2000, ...(describeIssue ? { describeIssue } : {}),
    });

    it('recusado, o modelo recebe os motivos em texto e a resposta corrigida é a que volta', async () => {
      const ai = fakeAI(inventado, corrigido);
      const outcome = await run(ai, (issue) => `TEXTO(${issue.error})`);
      expect(ai.calls).toHaveLength(2);
      expect(ai.calls[1].userContent).toContain('TEXTO(@core.reports/draft.unknown-field)');
      expect(ai.calls[1].userContent).toContain('"naoExiste"');
      expect(outcome.ok && outcome.draft.title).toBe('Por número');
      expect(outcome.ok && hasBlockingReportIssue(outcome.draft.issues)).toBe(false);
    });

    it('aceito de primeira, não há segunda chamada', async () => {
      const ai = fakeAI(corrigido);
      await run(ai, () => 'x');
      expect(ai.calls).toHaveLength(1);
    });

    it('a segunda resposta que recusa não apaga a primeira, que diz o que faltou', async () => {
      const outcome = await run(fakeAI(inventado, { error: 'não sei' }), () => 'x');
      expect(outcome.ok && outcome.draft.issues.map((issue) => issue.error)).toContain('@core.reports/draft.unknown-field');
    });

    it('sem quem descreva o motivo, não há segunda volta', async () => {
      const ai = fakeAI(inventado, corrigido);
      await run(ai);
      expect(ai.calls).toHaveLength(1);
    });
  });

  it('a gramática do relatório vai no pedido, com o filtro por período e o fixo', async () => {
    const { ai, run } = draft({ error: 'x' });
    await run();
    expect(ai.calls[0].options?.systemPrompt).toContain('"dataset.where"');
    expect(ai.calls[0].options?.systemPrompt).toContain('"control": "period"');
  });

  it('o modelo que recusa, ou não devolve spec, vira mensagem', async () => {
    expect(await draft({ error: 'não há tabela de vendas' }).run())
      .toEqual({ ok: false, error: '@core.reports/draft.refused', detail: 'não há tabela de vendas' });
    expect(await draft({ title: 'x' }).run()).toEqual({ ok: false, error: '@core.reports/draft.no-spec' });
  });
});
