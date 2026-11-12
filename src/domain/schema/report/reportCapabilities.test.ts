import { describe, it, expect } from 'vitest';
import {
  REPORT_CAPABILITIES,
  deriveReportRequires,
  reportCapabilitySeverity,
  unsupportedReportCapabilities,
} from './reportCapabilities';
import type { ReportSpec } from './reportSpec';

const base: ReportSpec = {
  v: 1,
  dataset: {
    table: 'lancamentos',
    dimensions: [{ key: 'situacao', path: 'situacao' }],
    measures: [{ key: 'total', op: 'sum', path: 'valor' }],
  },
  shape: { kind: 'summary', groupBy: [{ dimension: 'situacao' }], values: ['total'] },
};

/**
 * O que a versão 1.0 publicou.
 *
 * Asserida como SUBCONJUNTO, e não como igualdade: acrescentar capacidade é rotina, remover é
 * quebrar todo relatório que a declara. O molde é o de `sdkSurface.test.ts` — a lista é onde a
 * decisão fica registrada, e tirar algo dela passa a ser um gesto deliberado.
 */
const CAPABILITIES_1_0 = [
  'dataset.collection',
  'dimension.granularity',
  'export.csv',
  'export.pdf',
  'measure.aggregate',
  'measure.distinct',
  'measure.filter',
  'presentation.chart',
  'presentation.prompt',
  'shape.matrix',
  'shape.subtotal',
  'shape.summary',
  'shape.tabular',
];

describe('REPORT_CAPABILITIES', () => {
  it('só cresce — nenhuma capacidade da 1.0 desapareceu', () => {
    for (const capability of CAPABILITIES_1_0) {
      expect(REPORT_CAPABILITIES).toContain(capability);
    }
  });

  it('não anuncia o que o kernel ainda não executa', () => {
    expect(REPORT_CAPABILITIES).not.toContain('dataset.join');
    expect(REPORT_CAPABILITIES).not.toContain('schedule');
  });
});

describe('deriveReportRequires', () => {
  it('é derivada do spec, e não do que o autor escreveu', () => {
    expect(deriveReportRequires(base)).toEqual([
      'dataset.collection',
      'measure.aggregate',
      'shape.summary',
    ]);
  });

  it('nomeia cada recurso que o spec de fato usa', () => {
    const rico: ReportSpec = {
      ...base,
      dataset: {
        ...base.dataset,
        dimensions: [{ key: 'mes', path: 'vencimento', granularity: 'month' }],
        measures: [
          { key: 'total', op: 'sum', path: 'valor', filter: [{ path: 'situacao', op: 'eq' }] },
          { key: 'clientes', op: 'count', path: 'clienteId', distinct: true },
        ],
      },
      shape: {
        kind: 'matrix',
        rows: [{ dimension: 'mes', subtotal: true }],
        columns: [{ dimension: 'mes' }],
        values: ['total'],
      },
      presentation: { chart: { kind: 'bar' }, export: { csv: true } },
    };

    expect(deriveReportRequires(rico)).toEqual([
      'dataset.collection',
      'dimension.granularity',
      'export.csv',
      'measure.aggregate',
      'measure.distinct',
      'measure.filter',
      'presentation.chart',
      'shape.matrix',
      'shape.subtotal',
    ]);
  });

  it('a quebra do gráfico é capacidade deste kernel', () => {
    // O token nasceu para tirar `splitBy` do silêncio enquanto ele não era desenhado. Agora que é, o
    // mesmo token é o que deixa um kernel MAIS VELHO dizer que a quebra se perdeu.
    const quebrado: ReportSpec = {
      ...base,
      presentation: { chart: { kind: 'bar', splitBy: 'situacao' } },
    };

    expect(deriveReportRequires(quebrado)).toContain('presentation.chart.split');
    expect(unsupportedReportCapabilities(quebrado)).not.toContain('presentation.chart.split');
    expect(unsupportedReportCapabilities(quebrado, CAPABILITIES_1_0)).toContain('presentation.chart.split');
  });

  it('emite token que este kernel NÃO tem, para ele poder recusar pelo nome', () => {
    // É esse descompasso deliberado que faz um kernel velho dizer "não sei fazer join" em vez de
    // ler um lado só e devolver um número diferente com o mesmo rótulo.
    const juncao = { ...base, dataset: { ...base.dataset, kind: 'join' } } as ReportSpec;

    expect(deriveReportRequires(juncao)).toContain('dataset.join');
    expect(unsupportedReportCapabilities(juncao)).toEqual(['dataset.join']);
  });

  it('a medida calculada roda aqui, e um kernel que não a conhece a recusa pelo nome', () => {
    const calculada: ReportSpec = {
      ...base,
      dataset: {
        ...base.dataset,
        measures: [...(base.dataset.measures ?? []), { key: 'ticket', kind: 'computed', expression: 'a / b' }],
      },
    };

    expect(deriveReportRequires(calculada)).toContain('measure.computed');
    expect(unsupportedReportCapabilities(calculada)).toEqual([]);
    expect(unsupportedReportCapabilities(calculada, CAPABILITIES_1_0)).toEqual(['measure.computed']);
  });

  it('a propriedade que o contrato prevê e este kernel não lê emite token, para AVISAR', () => {
    // Sem isto elas eram no-op silencioso: o autor declarava e nada acontecia, sem uma palavra em
    // lugar nenhum. Com o token, cada uma cai no mesmo aviso de capacidade que já existia.
    const declarativo: ReportSpec = {
      ...base,
      dataset: {
        ...base.dataset,
        dimensions: [{ key: 'situacao', path: 'situacao', sort: { by: 'label' } }],
      },
      shape: { ...base.shape, limit: 10 } as ReportSpec['shape'],
      presentation: {
        fields: { total: { align: 'end' } },
        drillDown: { enabled: true },
        export: { fileName: 'x.csv' },
        prompts: [{
          key: 'situacao',
          path: 'situacao',
          op: 'eq',
          control: 'select',
          required: true,
          default: { kind: 'Literal', value: 'aberto' },
        }],
      },
    };

    expect(unsupportedReportCapabilities(declarativo).sort()).toEqual([
      'dimension.sort.by',
      'presentation.fields',
      'presentation.prompt.control',
      'shape.limit',
    ]);
  });

  it('o filtro obrigatório, o padrão e o período são executados — e um kernel anterior AVISA', () => {
    const perguntado: ReportSpec = {
      ...base,
      presentation: {
        prompts: [{
          key: 'mes',
          path: 'vencimento',
          op: 'gte',
          control: 'period',
          required: true,
          default: { kind: 'Literal', value: 'this-month' },
        }],
      },
    };

    expect(deriveReportRequires(perguntado)).toEqual(expect.arrayContaining([
      'presentation.prompt.default',
      'presentation.prompt.period',
      'presentation.prompt.required',
    ]));
    expect(unsupportedReportCapabilities(perguntado)).toEqual([]);
    expect(reportCapabilitySeverity('presentation.prompt.period')).toBe('warning');
  });

  it('ordenar por MEDIDA é o Top N, e não é a ordem por rótulo', () => {
    // Dois tokens porque são duas respostas: o kernel que sabe a primeira não pode anunciar a segunda.
    const topN: ReportSpec = {
      ...base,
      dataset: {
        ...base.dataset,
        dimensions: [{ key: 'situacao', path: 'situacao', sort: { by: 'total', dir: 'desc' }, limit: 5, others: true }],
      },
    };

    expect(deriveReportRequires(topN)).toEqual(expect.arrayContaining(['dimension.others', 'dimension.sort.measure']));
    expect(deriveReportRequires(topN)).not.toContain('dimension.sort.by');
    expect(unsupportedReportCapabilities(topN)).toEqual([]);
  });

  it('o destaque é aparência: executado aqui, aviso num kernel que não o conhece', () => {
    const realcado: ReportSpec = {
      ...base,
      presentation: { highlight: [{ measure: 'total', op: 'lt', value: 0, tone: 'negative' }] },
    };

    expect(deriveReportRequires(realcado)).toContain('presentation.highlight');
    expect(unsupportedReportCapabilities(realcado)).toEqual([]);
    expect(reportCapabilitySeverity('presentation.highlight')).toBe('warning');
  });

  it('ordenar por chave é o que este kernel faz, e não pede capacidade nenhuma', () => {
    const porChave: ReportSpec = {
      ...base,
      dataset: {
        ...base.dataset,
        dimensions: [{ key: 'situacao', path: 'situacao', sort: { by: 'key', dir: 'desc' } }],
      },
    };

    expect(unsupportedReportCapabilities(porChave)).toEqual([]);
  });

  it('um dataset de tipo desconhecido é recusado pelo discriminante', () => {
    const join: ReportSpec = { ...base, dataset: { ...base.dataset, kind: 'join' } };

    expect(unsupportedReportCapabilities(join)).toEqual(['dataset.join']);
  });

  it('agendamento declarado é reconhecido e recusado, nunca ignorado', () => {
    const agendado: ReportSpec = { ...base, schedule: { cron: '0 3 * * *' } };

    expect(unsupportedReportCapabilities(agendado)).toEqual(['schedule']);
  });

  it('o spec que só usa o que este kernel faz não pede nada que falte', () => {
    expect(unsupportedReportCapabilities(base)).toEqual([]);
  });
});

describe('deriveReportRequires — filtro por expressão', () => {
  it('pede token próprio, e ele RECUSA por estar sob `dataset.`', () => {
    // Um kernel que não execute a expressão somaria justamente as linhas que ela exclui, e sairia um
    // total menor com o mesmo rótulo. É a única resposta possível: recusar pelo nome.
    const comExpressao: ReportSpec = {
      ...base,
      dataset: { ...base.dataset, includeWhen: 'valor > 0' },
    };

    expect(deriveReportRequires(comExpressao)).toContain('dataset.includeWhen');
    expect(reportCapabilitySeverity('dataset.includeWhen')).toBe('error');
    expect(unsupportedReportCapabilities(comExpressao)).toEqual([]);
  });

  it('expressão em branco não pede nada — chave vazia não é capacidade usada', () => {
    const embranco: ReportSpec = { ...base, dataset: { ...base.dataset, includeWhen: '   ' } };

    expect(deriveReportRequires(embranco)).not.toContain('dataset.includeWhen');
  });
});

describe('deriveReportRequires — lista agrupada', () => {
  const grouped: ReportSpec = {
    v: 1,
    dataset: base.dataset,
    shape: {
      kind: 'tabular',
      columns: ['situacao'],
      groupBy: [{ dimension: 'situacao', subtotal: true }],
    },
  };

  it('a quebra em grupos tem TOKEN PRÓPRIO — sem ele o kernel velho some com os grupos calado', () => {
    expect(deriveReportRequires(grouped)).toEqual([
      'dataset.collection',
      'measure.aggregate',
      'shape.subtotal',
      'shape.tabular',
      'shape.tabular.group',
    ]);
  });

  it('a lista CORRIDA não o pede — quem não agrupa não perde nada num kernel que não agrupa', () => {
    expect(deriveReportRequires({ ...grouped, shape: { kind: 'tabular', columns: ['situacao'] } }))
      .not.toContain('shape.tabular.group');
  });

  it('a perda é AVISO, não recusa: o número não muda, só o desenho', () => {
    const missing = unsupportedReportCapabilities(grouped, ['dataset.collection', 'measure.aggregate', 'shape.tabular']);
    expect(missing).toContain('shape.tabular.group');
    expect(reportCapabilitySeverity('shape.tabular.group')).toBe('warning');
  });
});
