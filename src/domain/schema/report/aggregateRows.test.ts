import { describe, it, expect } from 'vitest';
import { aggregateReportRows, drillReportRows, reportCellKey } from './aggregateRows';
import type { ReportDimension, ReportSpec } from './reportSpec';
import { REPORT_OTHERS_KEY, REPORT_SPEC_VERSION } from './reportSpec';

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

describe('aggregateReportRows — o caminho que atravessa uma referência de VÁRIOS', () => {
  /** Como o plano de hidratação entrega uma referência de vários: uma lista de registros. */
  const multiRows: Record<string, unknown>[] = [
    { id: '1', amount: 10, poles: [{ id: 'p1', city: 'Recife' }, { id: 'p2', city: 'Olinda' }] },
    { id: '2', amount: 20, poles: [{ id: 'p1', city: 'Recife' }] },
    { id: '3', amount: 30, poles: [] },
  ];

  const multiSpec = (dimension: Omit<ReportDimension, 'key' | 'label'>): ReportSpec => ({
    v: REPORT_SPEC_VERSION,
    dataset: {
      table: 'processos',
      dimensions: [{ key: 'cidades', label: 'Cidades', ...dimension }],
      measures: [{ key: 'total', label: 'Total', op: 'sum', path: 'amount' }],
    },
    shape: { kind: 'summary', groupBy: [{ dimension: 'cidades' }], values: ['total'] },
  });

  it('agrupa pelo campo de cada apontado, e a lista vazia é o grupo sem valor', () => {
    const result = aggregateReportRows({ spec: multiSpec({ path: 'poles.city' }), rows: multiRows });
    const byCity = valuesByKey(result);

    expect(byCity['Recife,Olinda']).toEqual({ total: 10 });
    expect(byCity.Recife).toEqual({ total: 20 });
    expect(byCity['']).toEqual({ total: 30 });
  });

  it('soma o número de cada apontado, em vez de devolver zero', () => {
    // `Number([10, 20])` é `NaN`: sem achatar a lista, a medida saía na filtragem e o grupo mostrava
    // um total de zero — um número com a mesma cara de um total legítimo.
    const rowsWithValues = [{ id: '1', poles: [{ valor: 10 }, { valor: 20 }] }];
    const spec: ReportSpec = {
      v: REPORT_SPEC_VERSION,
      dataset: {
        table: 'processos',
        dimensions: [{ key: 'um', label: 'Um', path: 'id' }],
        measures: [{ key: 'total', label: 'Total', op: 'sum', path: 'poles.valor' }],
      },
      shape: { kind: 'summary', groupBy: [{ dimension: 'um' }], values: ['total'] },
    };

    expect(valuesByKey(aggregateReportRows({ spec, rows: rowsWithValues }))['1']).toEqual({ total: 30 });
  });

  it('o balde de data vale para a data de cada apontado', () => {
    const rowsWithDates = [{ id: '1', amount: 5, poles: [{ nascimento: '1990-03-14' }, { nascimento: '1990-03-28' }] }];
    const spec = multiSpec({ path: 'poles.nascimento', granularity: 'month' as const, timeZone: 'UTC' });

    expect(valuesByKey(aggregateReportRows({ spec, rows: rowsWithDates }))['1990-03,1990-03'])
      .toEqual({ total: 5 });
  });
});

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

  it('o `limit` da dimensão corta os membros E diz que o resultado é parcial', () => {
    // O total geral continua somando TODAS as linhas varridas, então as visíveis não fecham com ele.
    // Sem o aviso, isso é um recorte que se lê como o todo — e o leitor não tem como notar.
    const result = aggregateReportRows({
      spec: summarySpec({
        dataset: {
          ...dataset,
          dimensions: [
            ...dataset.dimensions.filter((one) => one.key !== 'cliente'),
            { key: 'cliente', path: 'client.name', label: 'Cliente', limit: 1 },
          ],
        },
        shape: { kind: 'summary', groupBy: [{ dimension: 'cliente' }], values: ['total'] },
      }),
      rows,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.completeGroups).toBe(false);
    expect(result.totals?.values.total).toBe(420);
  });

  it('o `limit` que cabe não torna o resultado parcial', () => {
    const result = aggregateReportRows({
      spec: summarySpec({
        dataset: {
          ...dataset,
          dimensions: [
            ...dataset.dimensions.filter((one) => one.key !== 'cliente'),
            { key: 'cliente', path: 'client.name', label: 'Cliente', limit: 5 },
          ],
        },
        shape: { kind: 'summary', groupBy: [{ dimension: 'cliente' }], values: ['total'] },
      }),
      rows,
    });

    expect(result.rows).toHaveLength(2);
    expect(result.completeGroups).toBe(true);
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

/**
 * O caminho de uma REFERÊNCIA chega hidratado: onde o documento guarda o id, a linha traz o registro
 * apontado inteiro. Enquanto a chave do grupo saía de `String(registro)`, apontados diferentes caíam
 * todos em `[object Object]` — um grupo só, e uma contagem distinta respondendo 1.
 */
describe('aggregateReportRows — dimensão de referência', () => {
  const referenceRows: Record<string, unknown>[] = [
    { id: '1', client: { id: 'c1', name: 'Ana' }, amount: 100 },
    { id: '2', client: { id: 'c2', name: 'Bruno' }, amount: 200 },
    { id: '3', client: { id: 'c1', name: 'Ana' }, amount: 50 },
  ];

  const referenceSpec: ReportSpec = {
    v: REPORT_SPEC_VERSION,
    dataset: {
      table: 'lancamentos',
      dimensions: [{ key: 'cliente', path: 'client', label: 'Cliente' }],
      measures: [
        { key: 'total', label: 'Total', op: 'sum' as const, path: 'amount' },
        { key: 'clientes', label: 'Clientes', op: 'count' as const, path: 'client', distinct: true },
      ],
    },
    shape: { kind: 'summary', groupBy: [{ dimension: 'cliente' }], values: ['total', 'clientes'] },
  };

  it('agrupa pelo ID do registro apontado, e não pelo objeto inteiro', () => {
    const result = aggregateReportRows({ spec: referenceSpec, rows: referenceRows });
    const byClient = valuesByKey(result);

    expect(Object.keys(byClient).sort()).toEqual(['c1', 'c2']);
    expect(byClient.c1.total).toBe(150);
    expect(byClient.c2.total).toBe(200);
  });

  it('a contagem DISTINTA conta apontados, não objetos', () => {
    const result = aggregateReportRows({ spec: referenceSpec, rows: referenceRows });

    expect(result.totals?.values.clientes).toBe(2);
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

  /**
   * O defeito que chegou à tela: a coluna de data de uma lista simples mostrava `[object Object]`.
   *
   * O documento guarda a data como Timestamp e a leitura a devolve como `Date` — e o codificador da
   * callable transforma um `Date` em `{}`, porque `Object.entries` de uma data não tem uma entrada
   * sequer. A data inteira se perdia na travessia, sem uma palavra dizendo que se perdeu.
   */
  it('a data atravessa a rede como texto ISO, nunca como Date', () => {
    const result = aggregateReportRows({
      spec: tabularSpec,
      rows: [{ id: '9', status: 'pago', dueDate: new Date('2026-03-01T12:00:00.000Z') }],
    });

    expect(result.records?.[0].dueDate).toBe('2026-03-01T12:00:00.000Z');
    expect(JSON.parse(JSON.stringify(result.records?.[0].dueDate))).toBe('2026-03-01T12:00:00.000Z');
  });

  it('a data DENTRO do registro apontado atravessa igual — a hidratação traz o registro inteiro', () => {
    const result = aggregateReportRows({
      spec: tabularSpec,
      rows: [{ id: '9', client: { name: 'Ana', since: new Date('2020-05-04T00:00:00.000Z') } }],
    });

    expect((result.records?.[0].client as Record<string, unknown>).since)
      .toBe('2020-05-04T00:00:00.000Z');
  });
});

describe('aggregateReportRows — medida calculada', () => {
  const calculada = (expression: string, extra: Partial<ReportSpec> = {}): ReportSpec => ({
    v: REPORT_SPEC_VERSION,
    dataset: {
      ...dataset,
      measures: [
        ...dataset.measures,
        { key: 'pagos', op: 'count', filter: [{ path: 'status', op: 'eq', value: { kind: 'Literal', value: 'pago' } }] },
        { key: 'ticket', label: 'Ticket', kind: 'computed', expression },
      ],
    },
    shape: { kind: 'summary', groupBy: [{ dimension: 'status' }], values: ['ticket'] },
    ...extra,
  });

  it('é a razão dos AGREGADOS do grupo, e lê medida que a dobra não mostra', () => {
    const result = aggregateReportRows({ spec: calculada('total / quantidade'), rows });

    expect(valuesByKey(result)).toEqual({
      '': { ticket: 70 },
      aberto: { ticket: 25 },
      pago: { ticket: 150 },
    });
    expect(result.totals?.values).toEqual({ ticket: 84 });
  });

  it('o total é a razão dos totais, nunca a média das razões das linhas', () => {
    const spec = calculada('pagos / quantidade * 100');
    const result = aggregateReportRows({
      spec,
      rows,
      measureFilters: { pagos: [{ path: 'status', op: 'eq', value: 'pago' }] },
    });

    expect(valuesByKey(result).pago).toEqual({ ticket: 100 });
    expect(valuesByKey(result).aberto).toEqual({ ticket: 0 });
    expect(result.totals?.values.ticket).toBe(40);
  });

  it('divisão por zero e medida citada sem valor saem vazias, não como número', () => {
    const vazio = aggregateReportRows({ spec: calculada('total / 0'), rows });
    expect(vazio.rows.every((row) => row.values.ticket === null)).toBe(true);

    // `media` do grupo sem valor numérico nenhum é null; a razão sobre ela também.
    const semMedia = aggregateReportRows({
      spec: calculada('media * 2'),
      rows: [{ id: '9', status: 'x', amount: 'texto' }],
    });
    expect(semMedia.rows[0].values.ticket).toBeNull();
  });

  it('é avaliada em cada célula, subtotal e total da coluna do pivô', () => {
    const result = aggregateReportRows({
      spec: calculada('total / quantidade', {
        shape: { kind: 'matrix', rows: [{ dimension: 'cliente' }], columns: [{ dimension: 'mes' }], values: ['ticket'] },
      }),
      rows,
    });

    const ana = result.rows.find((row) => row.keys[0].key === 'Ana');
    expect(ana?.cells?.[reportCellKey([{ dimension: 'mes', key: '2026-01' }])]).toEqual({ ticket: 100 });
    expect(ana?.cells?.[reportCellKey([{ dimension: 'mes', key: '2026-02' }])]).toEqual({ ticket: 25 });
    expect(ana?.values).toEqual({ ticket: 50 });
    expect(result.columnTotals?.[reportCellKey([{ dimension: 'mes', key: '2026-01' }])]).toEqual({ ticket: 150 });
  });

  it('um ciclo que escape da validação dá null, e não laço infinito', () => {
    const spec: ReportSpec = {
      v: REPORT_SPEC_VERSION,
      dataset: {
        ...dataset,
        measures: [
          { key: 'a', kind: 'computed', expression: 'b + 1' },
          { key: 'b', kind: 'computed', expression: 'a + 1' },
        ],
      },
      shape: { kind: 'summary', groupBy: [{ dimension: 'status' }], values: ['a', 'b'] },
    };

    expect(aggregateReportRows({ spec, rows }).totals?.values).toEqual({ a: null, b: null });
  });
});

/**
 * A LISTA AGRUPADA — o buraco entre as duas dobras que existiam.
 *
 * A lista corrida mostrava os registros e não os reunia; o resumo os reunia e não os mostrava. Quem
 * queria "o que cada cliente deve", e não "quanto", punha as dimensões numa dobra agrupada e perdia
 * as colunas: cada campo virava um nível de recuo, uma linha por coluna.
 */
describe('aggregateReportRows — lista agrupada', () => {
  const groupedSpec = (levels: { dimension: string; subtotal?: boolean }[]): ReportSpec => ({
    v: REPORT_SPEC_VERSION,
    dataset,
    shape: { kind: 'tabular', columns: ['cliente'], groupBy: levels },
  });

  it('devolve o grupo COM os registros dele, e o total do grupo junto', () => {
    const result = aggregateReportRows({ spec: groupedSpec([{ dimension: 'status' }]), rows });

    expect(result.rows.map((row) => row.keys[0].key)).toEqual(['', 'aberto', 'pago']);
    const pago = result.rows.find((row) => row.keys[0].key === 'pago');
    expect(pago?.records?.map((record) => record.id)).toEqual(['1', '2']);
    expect(pago?.values.total).toBe(300);
    expect(pago?.count).toBe(2);
  });

  it('o total geral continua sobre TODAS as linhas varridas, e não sobre as mostradas', () => {
    const result = aggregateReportRows({ spec: groupedSpec([{ dimension: 'status' }]), rows });

    expect(result.totals?.count).toBe(5);
    expect(result.totals?.values.quantidade).toBe(5);
  });

  it('os registros vão embrulhados para a rede — a data vira ISO em vez de {}', () => {
    const result = aggregateReportRows({
      spec: groupedSpec([{ dimension: 'status' }]),
      rows: [{ id: '9', status: 'pago', amount: 10, dueDate: new Date('2026-01-10T00:00:00.000Z') }],
    });

    expect(result.rows[0].records?.[0].dueDate).toBe('2026-01-10T00:00:00.000Z');
  });

  it('N níveis vêm em PROFUNDIDADE, o pai antes dos filhos, e só a folha traz registros', () => {
    const result = aggregateReportRows({
      spec: groupedSpec([{ dimension: 'status' }, { dimension: 'cliente' }]),
      rows,
    });

    const shape = result.rows.map((row) => ({
      level: row.level,
      key: row.keys[row.keys.length - 1].key,
      records: row.records?.length,
    }));

    expect(shape).toEqual([
      { level: 0, key: '', records: undefined },
      { level: 1, key: 'Bruno', records: 1 },
      { level: 0, key: 'aberto', records: undefined },
      { level: 1, key: 'Ana', records: 2 },
      { level: 0, key: 'pago', records: undefined },
      { level: 1, key: 'Ana', records: 1 },
      { level: 1, key: 'Bruno', records: 1 },
    ]);
  });

  it('o teto de registros é do RELATÓRIO, não do grupo — e esgotá-lo marca o resultado parcial', () => {
    const result = aggregateReportRows({
      spec: groupedSpec([{ dimension: 'status' }]),
      rows,
      limits: { maxRecords: 2 },
    });

    const shown = result.rows.reduce((count, row) => count + (row.records?.length ?? 0), 0);
    expect(shown).toBe(2);
    expect(result.completeGroups).toBe(false);
  });

  it('sem agrupamento nenhum continua sendo a lista corrida de sempre', () => {
    const result = aggregateReportRows({ spec: groupedSpec([]), rows });

    expect(result.rows).toEqual([]);
    expect(result.records).toHaveLength(5);
  });
});

describe('aggregateReportRows — Top N e "Outros"', () => {
  const topSpec = (dimension: Partial<ReportDimension>): ReportSpec => ({
    v: REPORT_SPEC_VERSION,
    dataset: {
      ...dataset,
      dimensions: dataset.dimensions.map((one) => (one.key === 'cliente' ? { ...one, ...dimension } : one)),
    },
    shape: { kind: 'summary', groupBy: [{ dimension: 'cliente' }], values: ['total', 'quantidade'] },
  });

  it('ordena os membros pelo valor de uma MEDIDA, do maior para o menor', () => {
    const result = aggregateReportRows({ spec: topSpec({ sort: { by: 'quantidade', dir: 'desc' } }), rows });

    expect(result.rows.map((row) => row.keys[0].key)).toEqual(['Ana', 'Bruno']);
  });

  it('com `others`, o que o limite deixou de fora vira UM grupo — e o resultado fecha com o total', () => {
    const result = aggregateReportRows({
      spec: topSpec({ sort: { by: 'total', dir: 'desc' }, limit: 1, others: true }),
      rows,
    });

    expect(result.rows.map((row) => row.keys[0].key)).toEqual(['Bruno', REPORT_OTHERS_KEY]);
    expect(result.rows[1].count).toBe(3);
    expect(result.rows.reduce((sum, row) => sum + row.count, 0)).toBe(result.totals?.count);
    expect(result.completeGroups).toBe(true);
  });

  it('sem `others`, o corte continua marcando o resultado como parcial', () => {
    const result = aggregateReportRows({
      spec: topSpec({ sort: { by: 'total', dir: 'desc' }, limit: 1 }),
      rows,
    });

    expect(result.rows.map((row) => row.keys[0].key)).toEqual(['Bruno']);
    expect(result.completeGroups).toBe(false);
  });

  it('a coluna "Outros" do pivô soma o que não é nenhuma das colunas mostradas', () => {
    const spec: ReportSpec = {
      v: REPORT_SPEC_VERSION,
      dataset: {
        ...dataset,
        dimensions: dataset.dimensions.map((one) => (one.key === 'cliente'
          ? { ...one, sort: { by: 'quantidade', dir: 'desc' as const }, limit: 1, others: true }
          : one)),
      },
      shape: { kind: 'matrix', rows: [{ dimension: 'status' }], columns: [{ dimension: 'cliente' }], values: ['quantidade'] },
    };

    const result = aggregateReportRows({ spec, rows });
    const othersKey = reportCellKey([{ dimension: 'cliente', key: REPORT_OTHERS_KEY }]);
    const anaKey = reportCellKey([{ dimension: 'cliente', key: 'Ana' }]);
    const pago = result.rows.find((row) => row.keys[0].key === 'pago');

    expect(result.columns.map((column) => column[0].key)).toEqual(['Ana', REPORT_OTHERS_KEY]);
    expect(pago?.cells?.[anaKey]?.quantidade).toBe(1);
    expect(pago?.cells?.[othersKey]?.quantidade).toBe(1);
    expect(result.columnTotals?.[othersKey]?.quantidade).toBe(2);
  });
});

describe('drillReportRows — os registros por trás do número', () => {
  const ids = (records: Record<string, unknown>[]): string[] => records.map((record) => String(record.id)).sort();

  it('devolve os registros do grupo clicado, e quantos são', () => {
    const drilled = drillReportRows({
      spec: summarySpec(),
      rows,
      target: { keys: [{ dimension: 'status', key: 'pago' }] },
    });

    expect(ids(drilled.records)).toEqual(['1', '2']);
    expect(drilled.matched).toBe(2);
  });

  it('o grupo "sem valor" também se detalha', () => {
    const drilled = drillReportRows({ spec: summarySpec(), rows, target: { keys: [{ dimension: 'status', key: '' }] } });
    expect(ids(drilled.records)).toEqual(['5']);
  });

  it('o "Outros" de um Top N detalha exatamente o que ele juntou', () => {
    const spec: ReportSpec = {
      ...summarySpec(),
      dataset: {
        ...dataset,
        dimensions: dataset.dimensions.map((one) => (one.key === 'cliente'
          ? { ...one, sort: { by: 'total', dir: 'desc' as const }, limit: 1, others: true }
          : one)),
      },
      shape: { kind: 'summary', groupBy: [{ dimension: 'cliente' }], values: ['total'] },
    };

    const others = drillReportRows({ spec, rows, target: { keys: [{ dimension: 'cliente', key: REPORT_OTHERS_KEY }] } });
    expect(ids(others.records)).toEqual(['1', '3', '4']);
  });

  it('a célula do pivô é a interseção da linha com a coluna', () => {
    const spec: ReportSpec = {
      v: REPORT_SPEC_VERSION,
      dataset,
      shape: { kind: 'matrix', rows: [{ dimension: 'status' }], columns: [{ dimension: 'cliente' }], values: ['quantidade'] },
    };

    const cell = drillReportRows({
      spec,
      rows,
      target: { keys: [{ dimension: 'status', key: 'aberto' }], column: [{ dimension: 'cliente', key: 'Ana' }] },
    });
    expect(ids(cell.records)).toEqual(['3', '4']);

    const columnTotal = drillReportRows({ spec, rows, target: { keys: [], column: [{ dimension: 'cliente', key: 'Bruno' }] } });
    expect(ids(columnTotal.records)).toEqual(['2', '5']);
  });

  it('respeita o teto de registros, mas diz quantos o recorte tem', () => {
    const drilled = drillReportRows({ spec: summarySpec(), rows, target: { keys: [] }, maxRecords: 2 });
    expect(drilled.records).toHaveLength(2);
    expect(drilled.matched).toBe(5);
  });
});
