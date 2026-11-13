import { describe, expect, it } from 'vitest';
import { createSchemaContext } from '../screenEntity';
import type { SchemaScreen } from '../screenEntity';
import type { ReportSpec } from './reportSpec';
import { reportDrillEnabled } from './reportSpec';
import { validateReportSpec } from './validateReportSpec';
import {
  reportAccessPermissions,
  reportSchemaOf,
  reportSeriesInfo,
  reportSnapshotDefinition,
  snapshotRefusal,
  snapshotReportView,
  snapshotSeriesRows,
  snapshotSeriesTable,
  snapshotSourceSpec,
  type ReportSnapshot,
} from './reportSnapshot';

const chamados: SchemaScreen = {
  id: 'chamados',
  titleSingular: 'Chamado',
  titleFieldKey: 'titulo',
  fields: [
    { key: 'titulo', label: 'Título', type: 'text', required: false, order: 0, origin: 'design' },
    {
      key: 'prioridade', label: 'Prioridade', type: 'select', required: false, order: 1, origin: 'design',
      options: [{ key: 'alta', label: 'Alta' }, { key: 'baixa', label: 'Baixa' }],
    },
    { key: 'abertoEm', label: 'Aberto em', type: 'date', required: false, order: 2, origin: 'design' },
  ],
};
const ctx = createSchemaContext([chamados]);

const source: ReportSpec = {
  v: 1,
  dataset: {
    table: 'chamados',
    dimensions: [{ key: 'prioridade', path: 'prioridade' }, { key: 'mes', path: 'abertoEm', granularity: 'month' }],
    measures: [{ key: 'qtd', op: 'count' }],
  },
  shape: { kind: 'summary', groupBy: [{ dimension: 'prioridade' }], values: ['qtd'] },
  access: { permission: 'chamados.painel' },
};

const series: ReportSpec = {
  v: 1,
  dataset: {
    kind: 'snapshot',
    table: 'por-prioridade',
    dimensions: [{ key: 'semana', path: 'takenAt', granularity: 'week' }, { key: 'prioridade', path: 'prioridade' }],
    measures: [{ key: 'abertos', op: 'sum', path: 'qtd' }],
  },
  shape: { kind: 'matrix', rows: [{ dimension: 'semana' }], columns: [{ dimension: 'prioridade' }], values: ['abertos'] },
};

const photo = (id: string, iso: string, definition = 'v1', extra: Partial<ReportSnapshot> = {}): ReportSnapshot => ({
  id, report: 'por-prioridade', takenAt: new Date(iso), definition, rows: [{ prioridade: 'alta', qtd: 3, count: 3 }],
  totals: { qtd: 3 }, count: 3, complete: true, truncated: false, takenBy: null, expiresAt: new Date('2031-01-01'), ...extra,
});

describe('série de instantâneos — o esquema da série', () => {
  const sources = [{ key: 'por-prioridade', title: 'Por prioridade', spec: source }];

  it('a série é lida como a coleção sintética: data da foto, dimensões, medidas e contagem', () => {
    const { ctx: seriesCtx, table } = reportSchemaOf(series, ctx, sources);
    expect(table).toBe(snapshotSeriesTable('por-prioridade'));
    const fields = seriesCtx.screens.get(table)?.fields ?? [];
    expect(fields.map((field) => [field.key, field.type])).toEqual([
      ['takenAt', 'date'], ['prioridade', 'select'], ['mes', 'text'], ['qtd', 'number'], ['count', 'number'],
    ]);
    // A dimensão que é um campo herda as opções — o grupo aparece por "Alta", não por "alta".
    expect(fields.find((field) => field.key === 'prioridade')?.options).toEqual(chamados.fields[1].options);
  });

  it('o relatório da série passa pela validação de sempre, contra o esquema dela', () => {
    const { ctx: seriesCtx } = reportSchemaOf(series, ctx, sources);
    const errors = validateReportSpec(snapshotReportView(series), { schema: seriesCtx })
      .filter((issue) => (issue.severity ?? 'error') === 'error');
    expect(errors).toEqual([]);
    // Sem a origem à mão, a tabela não resolve — e a validação diz por quê.
    expect(validateReportSpec(series, { schema: ctx }).map((issue) => issue.error)).toContain('@core.reports/dataset.table.unknown');
  });

  it('a série não usa relacionados, e não se detalha: a linha é uma foto, não um registro', () => {
    const comRelacionado: ReportSpec = { ...series, dataset: { ...series.dataset, related: [{ table: 'x', via: 'y', mode: 'with' }] } };
    expect(validateReportSpec(comRelacionado, { schema: ctx }).map((issue) => issue.error)).toContain('@core.reports/snapshot.related');
    expect(reportDrillEnabled(series)).toBe(false);
    expect(reportDrillEnabled(source)).toBe(true);
  });
});

describe('série de instantâneos — quem lê e o que se fotografa', () => {
  it('lê a série quem pode ler a ORIGEM, mais a permissão própria da série; sem origem, ninguém', () => {
    const restrita: ReportSpec = { ...series, access: { permission: 'series.ver' } };
    expect(reportAccessPermissions(restrita, ctx, source)).toEqual(['series.ver', 'chamados.painel', 'chamados.read']);
    expect(reportAccessPermissions(series, ctx, undefined)).toBeNull();
    expect(reportAccessPermissions(series, ctx, series)).toBeNull();
  });

  it('a origem é um relatório do ESCRITÓRIO — o pessoal com a mesma chave não empresta as permissões', () => {
    expect(snapshotSourceSpec(series, [{ key: 'por-prioridade', spec: source, ownerId: 'ana' }])).toBeUndefined();
    expect(snapshotSourceSpec(series, [{ key: 'por-prioridade', spec: source, ownerId: null }])).toBe(source);
  });

  it('só resumo e matriz são fotografados; nunca a lista simples, nunca outra série', () => {
    expect(snapshotRefusal(source)).toBeNull();
    expect(snapshotRefusal({ ...source, shape: { kind: 'tabular', columns: ['prioridade'] } })).toBe('@core.reports/snapshot.tabular');
    expect(snapshotRefusal(series)).toBe('@core.reports/snapshot.of-series');
  });

  it('a definição muda com o que define o número, e não com a apresentação', () => {
    const base = reportSnapshotDefinition(source);
    expect(reportSnapshotDefinition({ ...source, presentation: { chart: { kind: 'bar' } } } as ReportSpec)).toBe(base);
    expect(reportSnapshotDefinition({ ...source, dataset: { ...source.dataset, includeWhen: 'prioridade == "alta"' } })).not.toBe(base);
  });
});

describe('série de instantâneos — as linhas e o resumo', () => {
  it('cada foto vira linhas com a data dela; ids não colidem entre fotos', () => {
    const rows = snapshotSeriesRows([photo('a', '2026-11-02T08:00:00Z'), photo('b', '2026-11-09T08:00:00Z')]);
    expect(rows.map((row) => [row.id, (row.takenAt as Date).toISOString(), row.qtd])).toEqual([
      ['a:0', '2026-11-02T08:00:00.000Z', 3], ['b:0', '2026-11-09T08:00:00.000Z', 3],
    ]);
  });

  it('diz de quando a quando, se a definição mudou e se alguma foto foi parcial', () => {
    expect(reportSeriesInfo([photo('b', '2026-11-09T08:00:00Z', 'v2'), photo('a', '2026-11-02T08:00:00Z', 'v1', { truncated: true })])).toEqual({
      snapshots: 2,
      first: '2026-11-02T08:00:00.000Z',
      last: '2026-11-09T08:00:00.000Z',
      definitionChanged: true,
      partial: true,
    });
    expect(reportSeriesInfo([])).toEqual({ snapshots: 0, first: null, last: null, definitionChanged: false, partial: false });
  });
});
