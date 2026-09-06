import { describe, it, expect } from 'vitest';
import { REPORT_CAPABILITIES, deriveReportRequires, unsupportedReportCapabilities } from './reportCapabilities';
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
    expect(REPORT_CAPABILITIES).not.toContain('measure.computed');
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

  it('emite token que este kernel NÃO tem, para ele poder recusar pelo nome', () => {
    // É esse descompasso deliberado que faz um kernel velho dizer "não sei fazer medida calculada"
    // em vez de somar sem ela e devolver um número diferente com o mesmo rótulo.
    const calculada: ReportSpec = {
      ...base,
      dataset: {
        ...base.dataset,
        measures: [{ key: 'ticket', kind: 'computed', expression: 'a / b' }],
      },
    };

    expect(deriveReportRequires(calculada)).toContain('measure.computed');
    expect(unsupportedReportCapabilities(calculada)).toEqual(['measure.computed']);
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
      'export.filename',
      'presentation.drilldown',
      'presentation.fields',
      'presentation.prompt.control',
      'presentation.prompt.default',
      'presentation.prompt.required',
      'shape.limit',
    ]);
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
