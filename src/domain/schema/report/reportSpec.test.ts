import { describe, it, expect } from 'vitest';
import { createSchemaContext } from '../pathResolver';
import type { SchemaScreen } from '../pathResolver';
import {
  buildReportQuery,
  isAggregateMeasure,
  REPORT_OTHERS_KEY,
  REPORT_SPEC_VERSION,
  reportDrillColumns,
  reportGranularityOf,
  reportPaths,
  reportRequiredPermissions,
  reportSourceCollections,
} from './reportSpec';
import type { ReportSpec } from './reportSpec';

const personsScreen: SchemaScreen = {
  id: 'persons',
  titleSingular: 'Pessoa',
  titleFieldKey: 'name',
  fields: [
    { key: 'cidade', label: 'Cidade', type: 'text', required: false, order: 0, origin: 'design' },
  ],
};

const lancamentosScreen: SchemaScreen = {
  id: 'lancamentos',
  titleSingular: 'Lançamento',
  titleFieldKey: 'titulo',
  fields: [
    { key: 'titulo', label: 'Título', type: 'text', required: false, order: 0, origin: 'design' },
    { key: 'situacao', label: 'Situação', type: 'text', required: false, order: 1, origin: 'design' },
    { key: 'valor', label: 'Valor', type: 'currency', required: false, order: 2, origin: 'design' },
    { key: 'vencimento', label: 'Vencimento', type: 'date', required: false, order: 3, origin: 'design' },
    {
      key: 'clienteId',
      label: 'Cliente',
      type: 'reference',
      refEntity: 'persons',
      refDenormKey: 'cliente',
      required: false,
      order: 4,
      origin: 'design',
    },
  ],
};

const ctx = createSchemaContext([personsScreen, lancamentosScreen], []);

/**
 * O fixture CONGELADO da v1, escrito como literal.
 *
 * Um campo obrigatório novo o reprova — e é exatamente o que se quer: acrescentar obrigatoriedade a
 * um contrato que já viaja dentro de pacotes instalados é quebra, e ela precisa doer aqui antes de
 * doer no escritório.
 */
const FIXTURE_V1: ReportSpec = {
  v: 1,
  dataset: {
    table: 'lancamentos',
    where: [{ path: 'situacao', op: 'neq', value: { kind: 'Literal', value: 'cancelado' } }],
    dimensions: [
      { key: 'mes', path: 'vencimento', label: 'Mês', granularity: 'month', timeZone: 'America/Sao_Paulo' },
      { key: 'cidade', path: 'cliente.cidade', label: 'Cidade do cliente' },
    ],
    measures: [
      { key: 'total', label: 'Total', op: 'sum', path: 'valor' },
      { key: 'quantidade', label: 'Quantidade', op: 'count' },
    ],
  },
  shape: {
    kind: 'matrix',
    rows: [{ dimension: 'cidade', subtotal: true }],
    columns: [{ dimension: 'mes' }],
    values: ['total', 'quantidade'],
  },
  presentation: {
    chart: { kind: 'bar', category: 'mes', series: ['total'], stacked: true },
    export: { csv: true, pdf: true },
  },
};

describe('ReportSpec — a forma congelada', () => {
  it('o fixture da v1 continua sendo um spec válido desta versão', () => {
    expect(FIXTURE_V1.v).toBe(REPORT_SPEC_VERSION);
  });

  it('chave desconhecida no topo sobrevive à ida e volta', () => {
    // O repositório grava o spec VERBATIM. Um mapper que enumera propriedades apagaria o que este
    // kernel não conhece, e um relatório editado numa versão mais velha perderia em silêncio o que
    // uma mais nova escreveu.
    const comFuturo = { ...FIXTURE_V1, coisaDoFuturo: { profundidade: 2 } };
    const voltou = JSON.parse(JSON.stringify(comFuturo)) as typeof comFuturo;

    expect(voltou).toEqual(comFuturo);
    expect(voltou.coisaDoFuturo).toEqual({ profundidade: 2 });
  });

  it('medida sem `kind` é agregada — o padrão que não pode mudar', () => {
    // Todo spec gravado hoje omite o campo. Dar-lhe outro padrão reescreveria todos eles em
    // silêncio, sem que um único JSON mudasse.
    expect(isAggregateMeasure({ key: 'total', op: 'sum', path: 'valor' })).toBe(true);
    expect(isAggregateMeasure({ key: 'total', kind: 'aggregate', op: 'sum', path: 'valor' })).toBe(true);
    expect(isAggregateMeasure({ key: 'x', kind: 'computed', expression: 'a / b' })).toBe(false);
  });

  it('granularidade desconhecida deste kernel não vira outro balde', () => {
    expect(reportGranularityOf('month')).toBe('month');
    expect(reportGranularityOf('fortnight')).toBeUndefined();
  });
});

describe('reportPaths', () => {
  it('reúne todo caminho que o relatório lê, sem repetir', () => {
    expect(reportPaths(FIXTURE_V1).sort()).toEqual(['cliente.cidade', 'situacao', 'valor', 'vencimento']);
  });

  it('inclui o caminho do filtro de uma medida', () => {
    const spec: ReportSpec = {
      ...FIXTURE_V1,
      dataset: {
        ...FIXTURE_V1.dataset,
        measures: [
          { key: 'pagas', label: 'Pagas', op: 'sum', path: 'valor', filter: [{ path: 'situacao', op: 'eq' }] },
        ],
      },
    };

    expect(reportPaths(spec)).toContain('situacao');
  });

  it('ignora o caminho de uma medida calculada — ela não lê o registro', () => {
    const spec: ReportSpec = {
      ...FIXTURE_V1,
      dataset: {
        ...FIXTURE_V1.dataset,
        measures: [{ key: 'ticket', label: 'Ticket', kind: 'computed', expression: 'total / quantidade' }],
      },
    };

    expect(reportPaths(spec).sort()).toEqual(['cliente.cidade', 'situacao', 'vencimento']);
  });

  it('inclui os caminhos que a EXPRESSÃO lê', () => {
    // Sem eles, o caminho não é hidratado — chega ao avaliador como ausente — nem a coleção que ele
    // atravessa é cobrada de quem lê o relatório.
    const comExpressao: ReportSpec = {
      ...FIXTURE_V1,
      dataset: { ...FIXTURE_V1.dataset, includeWhen: 'valor > 0 and cliente.cidade == "Recife"' },
    };

    expect(reportPaths(comExpressao)).toContain('cliente.cidade');
    expect(reportPaths(comExpressao)).toContain('valor');
  });

  it('não confunde NOME DE FUNÇÃO com caminho', () => {
    // O extrator usa o mesmo parser que avalia, com as funções registradas. Num parser cru, `today`
    // e `isEmpty` saem como variáveis — e cada um viraria um caminho a hidratar.
    const comFuncoes: ReportSpec = {
      ...FIXTURE_V1,
      dataset: { ...FIXTURE_V1.dataset, includeWhen: 'isEmpty(situacao) or vencimento < today()' },
    };

    expect(reportPaths(comFuncoes)).not.toContain('today');
    expect(reportPaths(comFuncoes)).not.toContain('isEmpty');
  });
});

describe('buildReportQuery', () => {
  it('o limite da consulta É o orçamento de varredura', () => {
    // Cortar antes de agregar somaria as primeiras cem linhas e chamaria isso de total.
    const query = buildReportQuery(FIXTURE_V1, 2000);

    expect(query.limit).toBe(2000);
    expect(query.table).toBe('lancamentos');
    expect(query.where).toEqual(FIXTURE_V1.dataset.where);
    expect(query.projections.sort()).toEqual(['cliente.cidade', 'situacao', 'valor', 'vencimento']);
  });

  it('grampeia o que o relatório pediu acima do teto, em vez de recusar', () => {
    const spec: ReportSpec = { ...FIXTURE_V1, dataset: { ...FIXTURE_V1.dataset, scanLimit: 99999 } };

    expect(buildReportQuery(spec, 2000).limit).toBe(2000);
  });

  it('respeita um pedido menor que o teto', () => {
    const spec: ReportSpec = { ...FIXTURE_V1, dataset: { ...FIXTURE_V1.dataset, scanLimit: 50 } };

    expect(buildReportQuery(spec, 2000).limit).toBe(50);
  });

  it('leva a ordenação só quando a dobra é tabular — agrupado ordena por dimensão', () => {
    expect(buildReportQuery(FIXTURE_V1, 100).orderBy).toBeUndefined();

    const tabular: ReportSpec = {
      ...FIXTURE_V1,
      shape: { kind: 'tabular', columns: ['cidade'], orderBy: [{ path: 'valor', dir: 'desc' }] },
    };
    expect(buildReportQuery(tabular, 100).orderBy).toEqual([{ path: 'valor', dir: 'desc' }]);
  });
});

describe('reportSourceCollections', () => {
  it('inclui a coleção alcançada por hop de FK', () => {
    // Agrupar por `cliente.cidade` LÊ a coleção de pessoas. Sem esta coleção na lista, o relatório
    // entregaria um dado de Pessoas a quem não pode abrir Pessoas — a maior brecha do desenho.
    expect(reportSourceCollections(FIXTURE_V1, ctx).sort()).toEqual(['lancamentos', 'persons']);
  });

  it('devolve só a fonte quando nenhum caminho atravessa relação', () => {
    const spec: ReportSpec = {
      ...FIXTURE_V1,
      dataset: {
        ...FIXTURE_V1.dataset,
        dimensions: [{ key: 'situacao', path: 'situacao', label: 'Situação' }],
      },
      shape: { kind: 'summary', groupBy: [{ dimension: 'situacao' }], values: ['total'] },
    };

    expect(reportSourceCollections(spec, ctx)).toEqual(['lancamentos']);
  });

  it('devolve vazio quando a tabela não existe — quem executa recusa nomeando', () => {
    const spec: ReportSpec = { ...FIXTURE_V1, dataset: { ...FIXTURE_V1.dataset, table: 'nao-existe' } };

    expect(reportSourceCollections(spec, ctx)).toEqual([]);
  });
});

describe('reportRequiredPermissions', () => {
  it('é a leitura de cada coleção tocada quando o relatório não declara permissão própria', () => {
    expect(reportRequiredPermissions(FIXTURE_V1, ctx).sort()).toEqual(['lancamentos.read', 'persons.read']);
  });

  // A permissão própria só RESTRINGE: ela entra AO LADO das leituras, nunca no lugar delas.
  it('acrescenta a permissão própria, sem dispensar as leituras', () => {
    const spec: ReportSpec = { ...FIXTURE_V1, access: { permission: 'lancamentos.margem' } };
    expect(reportRequiredPermissions(spec, ctx).sort())
      .toEqual(['lancamentos.margem', 'lancamentos.read', 'persons.read']);
  });

  // A garantia que mantém `drillDown.columns` em `presentation`: só dimensão entra ali, e dimensão já
  // é lida e cobrada. Se um dia aceitar campo solto, este teste é o primeiro a dizer (#5).
  it('as colunas e a ordem do detalhe não mudam o que se lê nem o que se cobra', () => {
    const spec: ReportSpec = {
      ...FIXTURE_V1,
      presentation: {
        ...FIXTURE_V1.presentation,
        drillDown: { columns: ['mes', 'cidade', 'outra'], orderBy: [{ dimension: 'mes', dir: 'desc' }] },
      },
    };

    expect(reportPaths(spec).sort()).toEqual(reportPaths(FIXTURE_V1).sort());
    expect(reportRequiredPermissions(spec, ctx).sort()).toEqual(reportRequiredPermissions(FIXTURE_V1, ctx).sort());
  });

  it('ignora a permissão própria em branco', () => {
    const spec: ReportSpec = { ...FIXTURE_V1, access: { permission: '  ' } };
    expect(reportRequiredPermissions(spec, ctx)).not.toContain('  ');
  });
});

describe('reportDrillColumns — as colunas do detalhe (#5)', () => {
  /** O cenário da issue: um resumo de UM nível, por unidade, com consumo e valor somados. */
  const invoices: ReportSpec = {
    v: 1,
    dataset: {
      table: 'lancamentos',
      dimensions: [
        { key: 'unit', path: 'unidade', label: 'Unidade' },
        { key: 'month', path: 'vencimento', label: 'Mês', granularity: 'month' },
        { key: 'band', path: 'valor', label: 'Faixa', buckets: [{ key: 'low', lt: 100 }, { key: 'high' }] },
      ],
      measures: [
        { key: 'amount', label: 'Total', op: 'sum', path: 'valor' },
        { key: 'kwh', label: 'Consumo', op: 'sum', path: 'consumo' },
        { key: 'count', label: 'Faturas', op: 'count' },
        { key: 'paid', label: 'Pago', op: 'sum', path: 'pago', filter: [{ path: 'situacao', op: 'eq', value: { kind: 'Literal', value: 'pago' } }] },
        { key: 'people', label: 'Clientes', op: 'count', path: 'cliente', distinct: true },
      ],
    },
    shape: { kind: 'summary', groupBy: [{ dimension: 'unit' }], values: ['amount', 'kwh', 'count', 'paid', 'people'] },
  };
  const keys = (spec: ReportSpec, fixed: { dimension: string; key: string }[]): string[] =>
    reportDrillColumns(spec, fixed).map((column) => column.key);
  const unit = { dimension: 'unit', key: 'u1' };

  it('sem colunas declaradas: as outras dimensões e o campo de cada medida somada, sem a dimensão clicada', () => {
    // `valor` já é a faixa: não se repete como a medida que o soma. Contagem e medida filtrada ficam fora.
    expect(keys(invoices, [unit])).toEqual(['month', 'band', 'kwh']);
  });

  it('com colunas declaradas: só elas, na ordem, sem repetição e sem a dimensão clicada', () => {
    const spec: ReportSpec = { ...invoices, presentation: { drillDown: { columns: ['month', 'unit', 'month', 'nada'] } } };
    expect(keys(spec, [unit])).toEqual(['month']);
    expect(keys(spec, [])).toEqual(['month', 'unit']);
  });

  it('a dimensão clicada FICA quando o valor mostrado não é um só: o "Outros" e a faixa', () => {
    const spec: ReportSpec = { ...invoices, presentation: { drillDown: { columns: ['unit', 'band'] } } };
    expect(keys(spec, [{ dimension: 'unit', key: REPORT_OTHERS_KEY }, { dimension: 'band', key: 'low' }]))
      .toEqual(['unit', 'band']);
  });

  it('no pivô, sai a dimensão da linha E a da coluna', () => {
    const spec: ReportSpec = { ...invoices, presentation: { drillDown: { columns: ['unit', 'month', 'band'] } } };
    expect(keys(spec, [unit, { dimension: 'month', key: '2026-03' }])).toEqual(['band']);
  });

  it('se nada sobrar, volta às dimensões inteiras — um detalhe sem coluna esconderia os registros', () => {
    const spec: ReportSpec = {
      ...invoices,
      dataset: { ...invoices.dataset, dimensions: [invoices.dataset.dimensions![0]], measures: [{ key: 'count', op: 'count' }] },
      shape: { kind: 'summary', groupBy: [{ dimension: 'unit' }], values: ['count'] },
    };
    expect(keys(spec, [unit])).toEqual(['unit']);
    expect(keys({ ...spec, presentation: { drillDown: { columns: ['unit'] } } }, [unit])).toEqual(['unit']);
  });

  it('a coluna de medida carrega o caminho que lê, que já está entre os caminhos do relatório', () => {
    const measureColumns = reportDrillColumns(invoices, [unit]).filter((column) => column.kind === 'measure');
    expect(measureColumns.map((column) => column.kind === 'measure' && column.path)).toEqual(['consumo']);
    expect(reportPaths(invoices)).toContain('consumo');
  });
});
