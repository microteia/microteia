import { describe, it, expect } from 'vitest';
import type { ReportSpec } from './reportSpec';
import type { ReportResult } from './reportResult';
import { RUN_REPORT_MAX_ROWS, reportPromptParameters, reportTabLink, runReportStepOutputs } from './reportStep';
import { REPORT_PERIODS } from './reportPeriod';

const spec: ReportSpec = {
  v: 1,
  dataset: {
    table: 'vendas',
    dimensions: [{ key: 'regiao', path: 'regiao' }, { key: 'vendedor', path: 'vendedorId' }],
    measures: [
      { key: 'receita', op: 'sum', path: 'valor' },
      { key: 'ticket', op: 'avg', path: 'valor' },
    ],
  },
  shape: { kind: 'summary', groupBy: [{ dimension: 'regiao' }, { dimension: 'vendedor' }], values: ['receita', 'ticket'] },
};

const result = (rows: ReportResult['rows'], overrides: Partial<ReportResult> = {}): ReportResult => ({
  shape: 'summary',
  columns: [],
  rows,
  totals: { values: { receita: 900, ticket: 300 }, count: 3 },
  scanned: 3,
  complete: true,
  completeGroups: true,
  generatedAt: '2026-05-05T12:00:00.000Z',
  ...overrides,
});

describe('runReportStepOutputs', () => {
  it('publica só os grupos do nível mais fundo, sem os subtotais', () => {
    const outputs = runReportStepOutputs(spec, result([
      { keys: [{ dimension: 'regiao', key: 'sul' }], values: { receita: 900, ticket: 300 }, count: 3, level: 0, subtotal: true },
      {
        keys: [{ dimension: 'regiao', key: 'sul' }, { dimension: 'vendedor', key: 'v1' }],
        values: { receita: 600, ticket: 300 }, count: 2, level: 1,
      },
      {
        keys: [{ dimension: 'regiao', key: 'sul' }, { dimension: 'vendedor', key: 'v2' }],
        values: { receita: 300, ticket: 300 }, count: 1, level: 1,
      },
    ]));

    expect(outputs.total).toBe(900);
    expect(outputs.totals).toEqual({ receita: 900, ticket: 300 });
    expect(outputs.groups).toBe(2);
    expect(outputs.rows[0]).toEqual({ regiao: 'sul', vendedor: 'v1', receita: 600, ticket: 300, count: 2 });
  });

  it('admite o parcial: varredura OU grupos cortados', () => {
    expect(runReportStepOutputs(spec, result([], { complete: false })).complete).toBe(false);
    expect(runReportStepOutputs(spec, result([], { completeGroups: false })).complete).toBe(false);
  });

  it('corta as linhas no teto e diz que cortou', () => {
    const many = Array.from({ length: RUN_REPORT_MAX_ROWS + 5 }, (_, index) => ({
      keys: [{ dimension: 'regiao', key: `r${index}` }], values: { receita: index }, count: 1, level: 0,
    }));
    const outputs = runReportStepOutputs(spec, result(many));

    expect(outputs.rows).toHaveLength(RUN_REPORT_MAX_ROWS);
    expect(outputs.groups).toBe(RUN_REPORT_MAX_ROWS + 5);
    expect(outputs.rowsTruncated).toBe(true);
  });

  it('sem total, o número é nulo — nunca zero', () => {
    expect(runReportStepOutputs(spec, result([], { totals: null })).total).toBeNull();
  });
});

describe('reportPromptParameters', () => {
  it('o filtro de período vira a lista fechada dos períodos', () => {
    const [period, plain] = reportPromptParameters({
      ...spec,
      presentation: {
        prompts: [
          { key: 'quando', label: 'Quando', path: 'data', op: 'eq', control: 'period' },
          { key: 'regiao', path: 'regiao', op: 'eq', required: true },
        ],
      },
    });

    expect(period.type).toBe('select');
    expect(period.options?.map((option) => option.value)).toEqual([...REPORT_PERIODS]);
    expect(plain).toEqual({ key: 'regiao', label: 'regiao', type: 'String', required: true });
  });

  it('o obrigatório com padrão não é cobrado do passo: o padrão responde', () => {
    const [prompt] = reportPromptParameters({
      ...spec,
      presentation: {
        prompts: [{ key: 'regiao', path: 'regiao', op: 'eq', required: true, default: { kind: 'Literal', value: 'sul' } }],
      },
    });
    expect(prompt.required).toBeUndefined();
  });
});

describe('reportTabLink', () => {
  it('é o endereço da aba do relatório', () => {
    expect(reportTabLink('receita')).toBe('rep:receita');
  });
});
