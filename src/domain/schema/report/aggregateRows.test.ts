import { describe, it, expect } from 'vitest';
import { aggregateReportRows, reportCellKey } from './aggregateRows';
import type { ReportSpec } from './reportSpec';
import { REPORT_SPEC_VERSION } from './reportSpec';

/**
 * As linhas chegam ao agregador já varridas, hidratadas e materializadas — é por isso que
 * `client.name` é um caminho e o valor está aninhado, como o plano de hidratação o entrega.
 */
const rows: Record<string, unknown>[] = [
  { id: '1', status: 'pago', amount: 100, dueDate: '2026-01-10', client: { name: 'Ana' } },
  { id: '2', status: 'pago', amount: 200, dueDate: '2026-01-20', client: { name: 'Bruno' } },
  { id: '3', status: 'aberto', amount: 50, dueDate: '2026-02-05', client: { name: 'Ana' } },
  { id: '4', status: 'aberto', amount: 'nao-numero', dueDate: '2026-02-11', client: { name: 'Ana' } },
  { id: '5', status: null, amount: 70, dueDate: '2026-02-27', client: { name: 'Bruno' } },
];

const dataset = {
  table: 'lancamentos',
  dimensions: [
    { key: 'status', path: 'status', label: 'Situação' },
    { key: 'mes', path: 'dueDate', label: 'Mês', granularity: 'month' as const, timeZone: 'UTC' },
    { key: 'cliente', path: 'client.name', label: 'Cliente' },
  ],
  measures: [
    { key: 'total', label: 'Total', op: 'sum' as const, path: 'amount' },
    { key: 'quantidade', label: 'Quantidade', op: 'count' as const },
    { key: 'media', label: 'Média', op: 'avg' as const, path: 'amount' },
  ],
};

const summarySpec = (overrides: Partial<ReportSpec> = {}): ReportSpec => ({
  v: REPORT_SPEC_VERSION,
  dataset,
  shape: { kind: 'summary', groupBy: [{ dimension: 'status' }], values: ['total', 'quantidade'] },
  ...overrides,
});

const valuesByKey = (result: ReturnType<typeof aggregateReportRows>): Record<string, Record<string, number | null>> =>
  Object.fromEntries(result.rows.map((row) => [row.keys[row.keys.length - 1].key, row.values]));

describe('aggregateReportRows — summary', () => {
  it('agrupa por um nível, somando e contando', () => {
    const result = aggregateReportRows({ spec: summarySpec(), rows });
    const byStatus = valuesByKey(result);

    expect(byStatus.pago).toEqual({ total: 300, quantidade: 2 });
    expect(byStatus.aberto).toEqual({ total: 50, quantidade: 2 });
    expect(result.rows).toHaveLength(3);
  });

  it('trata o valor ausente como um grupo, e não como uma linha perdida', () => {
    // "Sem situação" é uma resposta legítima: descartar essas linhas faria o total do relatório
    // discordar do total da listagem, e a diferença não apareceria em lugar nenhum.
    const result = aggregateReportRows({ spec: summarySpec(), rows });

    expect(valuesByKey(result)['']).toEqual({ total: 70, quantidade: 1 });
    expect(result.totals).toEqual({ values: { total: 420, quantidade: 5 }, count: 5 });
  });

  it('emite o subtotal do nível que o declara, antes dos filhos dele', () => {
    const result = aggregateReportRows({
      spec: summarySpec({
        shape: {
          kind: 'summary',
          groupBy: [{ dimension: 'status', subtotal: true }, { dimension: 'cliente' }],
          values: ['total'],
        },
      }),
      rows,
    });

    const shape = result.rows.map((row) => ({
      level: row.level,
      key: row.keys[row.keys.length - 1].key,
      subtotal: row.subtotal === true,
      total: row.values.total,
    }));

    expect(shape).toEqual([
      { level: 0, key: '', subtotal: true, total: 70 },
      { level: 1, key: 'Bruno', subtotal: false, total: 70 },
      { level: 0, key: 'aberto', subtotal: true, total: 50 },
      { level: 1, key: 'Ana', subtotal: false, total: 50 },
      { level: 0, key: 'pago', subtotal: true, total: 300 },
      { level: 1, key: 'Ana', subtotal: false, total: 100 },
      { level: 1, key: 'Bruno', subtotal: false, total: 200 },
    ]);
  });

  it('não emite o nível intermediário que não pediu subtotal', () => {
    const result = aggregateReportRows({
      spec: summarySpec({
        shape: {
          kind: 'summary',
          groupBy: [{ dimension: 'status' }, { dimension: 'cliente' }],
          values: ['total'],
        },
      }),
      rows,
    });

    // Só as folhas saem — mas cada uma carrega o CAMINHO inteiro de chaves, que é o que permite ao
    // renderizador desenhar o agrupamento mesmo sem uma linha de cabeçalho para cada nível.
    expect(result.rows.every((row) => row.level === 1)).toBe(true);
    expect(result.rows.every((row) => row.keys.length === 2)).toBe(true);
    expect(result.rows.map((row) => row.keys.map((entry) => entry.key).join(' / '))).toEqual([
      ' / Bruno',
      'aberto / Ana',
      'pago / Ana',
      'pago / Bruno',
    ]);
  });

  it('respeita o balde de data no fuso declarado', () => {
    const result = aggregateReportRows({
      spec: summarySpec({
        shape: { kind: 'summary', groupBy: [{ dimension: 'mes' }], values: ['total'] },
      }),
      rows,
    });

    expect(valuesByKey(result)).toEqual({
      '2026-01': { total: 300 },
      '2026-02': { total: 120 },
    });
  });

  it('soma sem número nenhum é 0; média sem número nenhum é null', () => {
    // A convenção é a de `applyAggregationOp`, e ela é reusada de propósito: um total de relatório e
    // um campo agregado não podem discordar sobre o que significa "nenhum valor".
    const onlyText = [{ id: 'x', status: 'aberto', amount: 'nao-numero' }];
    const result = aggregateReportRows({
      spec: summarySpec({
        shape: { kind: 'summary', groupBy: [{ dimension: 'status' }], values: ['total', 'media'] },
      }),
      rows: onlyText,
    });

    expect(result.rows[0].values).toEqual({ total: 0, media: null });
  });

  it('a medida FILTRADA restringe só a si mesma', () => {
    const result = aggregateReportRows({
      spec: summarySpec({
        dataset: {
          ...dataset,
          measures: [
            ...dataset.measures,
            { key: 'pagas', label: 'Pagas', op: 'sum', path: 'amount', filter: [] },
          ],
        },
        shape: { kind: 'summary', groupBy: [{ dimension: 'cliente' }], values: ['total', 'pagas'] },
      }),
      rows,
      measureFilters: { pagas: [{ path: 'status', op: 'eq', value: 'pago' }] },
    });

    expect(valuesByKey(result)).toEqual({
      Ana: { total: 150, pagas: 100 },
      Bruno: { total: 270, pagas: 200 },
    });
  });

  it('conta valores distintos quando a medida pede', () => {
    const result = aggregateReportRows({
      spec: summarySpec({
        dataset: {
          ...dataset,
          measures: [{ key: 'clientes', label: 'Clientes', op: 'count', path: 'client.name', distinct: true }],
        },
        shape: { kind: 'summary', groupBy: [{ dimension: 'status' }], values: ['clientes'] },
      }),
      rows,
    });

    expect(valuesByKey(result)).toEqual({
      '': { clientes: 1 },
      aberto: { clientes: 1 },
      pago: { clientes: 2 },
    });
  });

  it('avisa quando cortou grupos, em vez de devolver um recorte silencioso', () => {
    const result = aggregateReportRows({
      spec: summarySpec(),
      rows,
      limits: { maxGroups: 2 },
    });

    expect(result.rows).toHaveLength(2);
    expect(result.completeGroups).toBe(false);
  });

  it('carrega a varredura parcial para fora — `complete` nunca é inventado', () => {
    const result = aggregateReportRows({ spec: summarySpec(), rows, scanned: 2000, complete: false });

    expect(result.scanned).toBe(2000);
    expect(result.complete).toBe(false);
  });

  it('não calcula total geral quando a dobra o desliga', () => {
    const result = aggregateReportRows({
      spec: summarySpec({
        shape: { kind: 'summary', groupBy: [{ dimension: 'status' }], values: ['total'], grandTotal: false },
      }),
      rows,
    });

    expect(result.totals).toBeNull();
  });
});

describe('aggregateReportRows — matrix', () => {
  const matrixSpec: ReportSpec = {
    v: REPORT_SPEC_VERSION,
    dataset,
    shape: {
      kind: 'matrix',
      rows: [{ dimension: 'cliente' }],
      columns: [{ dimension: 'status' }],
      values: ['total'],
    },
  };

  it('cruza linhas e colunas, com o total nas duas bordas', () => {
    const result = aggregateReportRows({ spec: matrixSpec, rows });

    expect(result.columns.map((column) => column[0].key)).toEqual(['', 'aberto', 'pago']);

    const ana = result.rows.find((row) => row.keys[0].key === 'Ana');
    expect(ana?.cells?.[reportCellKey([{ dimension: 'status', key: 'pago' }])]).toEqual({ total: 100 });
    expect(ana?.cells?.[reportCellKey([{ dimension: 'status', key: 'aberto' }])]).toEqual({ total: 50 });
    expect(ana?.values).toEqual({ total: 150 });

    expect(result.totals).toEqual({ values: { total: 420 }, count: 5 });
  });

  it('a célula sem nenhuma linha traz a medida vazia, não some do objeto', () => {
    // Zero e ausente não são a mesma afirmação, e é a célula presente que permite ao renderizador
    // escolher entre "0" e vazio pelo `emptyCell` da dobra.
    const result = aggregateReportRows({ spec: matrixSpec, rows });
    const bruno = result.rows.find((row) => row.keys[0].key === 'Bruno');

    expect(bruno?.cells?.[reportCellKey([{ dimension: 'status', key: 'aberto' }])]).toEqual({ total: 0 });
  });

  it('devolve o total de cada COLUNA, calculado sobre as linhas — não somando as células', () => {
    // Somar as células exibidas daria o número errado em toda medida que não é soma: média de
    // médias não é média, e contagem distinta somada conta duas vezes quem aparece em duas colunas.
    const result = aggregateReportRows({
      spec: {
        ...matrixSpec,
        dataset: {
          ...dataset,
          measures: [
            { key: 'total', label: 'Total', op: 'sum', path: 'amount' },
            { key: 'clientes', label: 'Clientes', op: 'count', path: 'client.name', distinct: true },
          ],
        },
        shape: { ...matrixSpec.shape, values: ['total', 'clientes'] } as typeof matrixSpec.shape,
      },
      rows,
    });

    const pago = reportCellKey([{ dimension: 'status', key: 'pago' }]);
    expect(result.columnTotals?.[pago]).toEqual({ total: 300, clientes: 2 });

    const aberto = reportCellKey([{ dimension: 'status', key: 'aberto' }]);
    expect(result.columnTotals?.[aberto]).toEqual({ total: 50, clientes: 1 });
  });

  it('não devolve total de coluna quando a dobra desliga o total', () => {
    const result = aggregateReportRows({
      spec: { ...matrixSpec, shape: { ...matrixSpec.shape, grandTotal: false } as typeof matrixSpec.shape },
      rows,
    });

    expect(result.columnTotals).toBeUndefined();
  });

  it('avisa quando cortou colunas do pivô', () => {
    const result = aggregateReportRows({ spec: matrixSpec, rows, limits: { maxColumns: 1 } });

    expect(result.columns).toHaveLength(1);
    expect(result.completeGroups).toBe(false);
  });
});

describe('aggregateReportRows — tabular', () => {
  const tabularSpec: ReportSpec = {
    v: REPORT_SPEC_VERSION,
    dataset,
    shape: { kind: 'tabular', columns: ['status', 'cliente'] },
  };

  it('devolve os registros e o total, sem grupos', () => {
    const result = aggregateReportRows({ spec: tabularSpec, rows });

    expect(result.rows).toHaveLength(0);
    expect(result.records).toHaveLength(5);
    expect(result.totals?.count).toBe(5);
  });

  it('devolve os registros em `records`, e NÃO em `rows` — quem desenha precisa saber disso', () => {
    // O defeito que isto trava chegou à tela: a tabela lia `rows` nos dois casos e mostrava
    // "Nenhum dado" sobre uma coleção cheia. Numa lista simples não há grupo — há registro.
    const result = aggregateReportRows({ spec: tabularSpec, rows });

    expect(result.rows).toEqual([]);
    expect(result.records?.map((record) => record.id)).toEqual(['1', '2', '3', '4', '5']);
    expect(result.totals?.values.quantidade).toBe(5);
  });

  it('avisa quando cortou registros', () => {
    const result = aggregateReportRows({ spec: tabularSpec, rows, limits: { maxRecords: 2 } });

    expect(result.records).toHaveLength(2);
    expect(result.completeGroups).toBe(false);
  });
});

describe('aggregateReportRows — medida calculada', () => {
  it('devolve null em vez de somar sem ela — a segunda linha de defesa', () => {
    // A PRIMEIRA é a recusa por capacidade: quem declara `measure.computed` num kernel que não a
    // executa é recusado pelo nome dela, antes de chegar aqui.
    const result = aggregateReportRows({
      spec: {
        v: REPORT_SPEC_VERSION,
        dataset: {
          ...dataset,
          measures: [{ key: 'ticket', label: 'Ticket', kind: 'computed', expression: 'total / quantidade' }],
        },
        shape: { kind: 'summary', groupBy: [{ dimension: 'status' }], values: ['ticket'] },
      },
      rows,
    });

    expect(result.rows.every((row) => row.values.ticket === null)).toBe(true);
  });
});
