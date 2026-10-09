import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin, TemplateField } from '../../entities/MarketplacePlugin';
import { AGGREGATION_OP_SINCE_KERNEL } from '../../schema/aggregationSpec';
import type { FieldAggregation } from '../../schema/fieldRules';
import { packageAggregationIssues } from './pluginAggregations';
import { packageIssues } from './pluginReferences';

const field = (overrides: Partial<TemplateField> & Pick<TemplateField, 'key'>): TemplateField => ({
  label: overrides.key,
  type: 'text',
  required: false,
  order: 0,
  ...overrides,
});

const latest: FieldAggregation = {
  from: 'movimentos',
  via: 'processo',
  op: 'latest',
  field: 'resultado',
  orderBy: [{ path: 'data', dir: 'desc' }, { path: 'hora', dir: 'desc' }],
  filter: 'tipo == "Decisão" and resultado != ""',
};

const pkg = (
  aggregation: FieldAggregation,
  kernel = `^${AGGREGATION_OP_SINCE_KERNEL.latest}`,
  parent: Partial<TemplateField> = {},
): MarketplacePlugin => ({
  summary: 'x',
  manifest: { id: 'com.acme.movimentos', version: '1.0.0', kernel, name: 'Movimentos' },
  workflows: [],
  lookups: [{ collection: 'resultados', label: 'Resultados' }],
  screens: [
    {
      key: 'processos',
      titleSingular: 'Processo',
      titlePlural: 'Processos',
      icon: 'folder',
      titleFieldKey: 'numero',
      fields: [
        field({ key: 'numero' }),
        field({ key: 'resultado', type: 'select', lookupCollection: 'resultados', aggregation, ...parent }),
      ],
    },
    {
      key: 'movimentos',
      titleSingular: 'Movimento',
      titlePlural: 'Movimentos',
      icon: 'list',
      titleFieldKey: 'tipo',
      fields: [
        field({ key: 'processo', type: 'reference', refEntity: 'processos' }),
        field({ key: 'tipo' }),
        field({ key: 'data', type: 'date' }),
        field({ key: 'hora', type: 'time' }),
        field({ key: 'resultado', type: 'select', lookupCollection: 'resultados' }),
        field({ key: 'valor', type: 'currency' }),
      ],
    },
  ],
});

const details = (plugin: MarketplacePlugin) =>
  packageAggregationIssues(plugin).map((issue) => issue.messageParams?.detail ?? issue.message);

describe('packageAggregationIssues', () => {
  it('aceita o latest completo, com o kernel que o conhece', () => {
    expect(packageAggregationIssues(pkg(latest))).toEqual([]);
  });

  it('recusa latest sem field ou sem orderBy, com mensagem', () => {
    expect(details(pkg({ ...latest, field: null }))).toEqual(['@core.records/aggregation.issue.latest-field']);
    expect(details(pkg({ ...latest, orderBy: undefined }))).toEqual(['@core.records/aggregation.issue.latest-order']);
  });

  it('recusa orderBy e field que não são campos do filho', () => {
    expect(details(pkg({ ...latest, orderBy: [{ path: 'nada', dir: 'desc' }] })))
      .toEqual(['@core.records/aggregation.issue.unknown-order']);
    expect(details(pkg({ ...latest, field: 'nada' }))).toEqual(['@core.records/aggregation.issue.unknown-field']);
  });

  it('recusa um pai de tipo incompatível com o do filho', () => {
    expect(details(pkg({ ...latest, field: 'valor' }))).toEqual(['@core.records/aggregation.issue.type-mismatch']);
    expect(details(pkg(latest, undefined, { type: 'text', lookupCollection: null })))
      .toEqual(['@core.records/aggregation.issue.type-mismatch']);
  });

  it('recusa orderBy em qualquer outra operação', () => {
    const sum: FieldAggregation = { from: 'movimentos', via: 'processo', op: 'sum', field: 'valor', orderBy: latest.orderBy };
    expect(details(pkg(sum, undefined, { type: 'currency', lookupCollection: null })))
      .toEqual(['@core.records/aggregation.issue.order-not-latest']);
  });

  it('a recusa diz qual tela e qual campo, e embute a frase do detalhe', () => {
    const [issue] = packageAggregationIssues(pkg({ ...latest, field: 'nada' }));
    expect(issue.message).toBe('@core.marketplace/issue.aggregation.invalid');
    expect(issue.messageParams).toMatchObject({ screen: 'processos', field: 'resultado', childField: 'nada', detail: '@core.records/aggregation.issue.unknown-field' });
  });

  it('o pacote que usa latest com um kernel que admite versões anteriores é recusado', () => {
    const issues = packageAggregationIssues(pkg(latest, '^2.0.0'));
    expect(issues).toEqual([{
      message: '@core.marketplace/issue.aggregation.kernel',
      messageParams: { screen: 'processos', field: 'resultado', op: 'latest', minimum: AGGREGATION_OP_SINCE_KERNEL.latest },
    }]);
  });

  it('as operações numéricas não pedem kernel novo', () => {
    const sum: FieldAggregation = { from: 'movimentos', via: 'processo', op: 'sum', field: 'valor' };
    expect(packageAggregationIssues(pkg(sum, '^2.0.0', { type: 'currency', lookupCollection: null }))).toEqual([]);
  });

  it('o filho de outra extensão não é conferido campo a campo', () => {
    expect(packageAggregationIssues(pkg({ ...latest, from: 'outra__movimentos', field: 'qualquer' }))).toEqual([]);
  });

  it('entra na porta única do pacote', () => {
    expect(packageIssues(pkg({ ...latest, field: null })).map((issue) => issue.message))
      .toContain('@core.marketplace/issue.aggregation.invalid');
  });
});
