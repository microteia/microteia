import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { WIDGET_DATA_SINCE_KERNEL, WIDGET_FILTER_CHOICE_SINCE_KERNEL, WIDGET_PERIOD_RELATIVE_SINCE_KERNEL } from '../../schema/ui/widgetSpec';
import type { WidgetFilter, WidgetSpec } from '../../schema/ui/widgetSpec';
import { packageWidgetDataIssues, packageWidgetPeriodIssues, widgetOutRefs, WIDGET_REF_ORIGIN } from './pluginWidgetData';
import { packageIssues, validatePackage } from './pluginReferences';

const pkg = (spec: WidgetSpec, kernel: string, point = 'ui.page'): MarketplacePlugin => ({
  summary: 'x',
  manifest: {
    id: 'com.acme.sales',
    version: '1.0.0',
    kernel,
    name: 'Sales',
    contributes: [{ point, id: 'sales', apiVersion: '1', metadata: {}, impl: { kind: 'widget', spec: spec as unknown as Record<string, unknown> } }],
  },
  workflows: [],
});

const painel: WidgetSpec = {
  type: 'filters',
  filters: [{ key: 'when', control: 'period', default: 'this-month' }],
  children: [{ type: 'metric', label: 'Receita', report: 'acme-revenue', bind: { period: 'when' } }],
};

describe('Widget DSL que liga dados, no pacote', () => {
  it('o kernel anterior é recusa: ele ignoraria a barra e o painel inteiro sumiria', () => {
    expect(packageWidgetDataIssues(pkg(painel, '^2.111.0'))).toEqual([{
      message: '@core.marketplace/issue.widget.data-kernel',
      messageParams: { contribution: 'sales', feature: 'filters', minimum: WIDGET_DATA_SINCE_KERNEL },
    }]);
    expect(packageWidgetDataIssues(pkg(painel, `^${WIDGET_DATA_SINCE_KERNEL}`))).toEqual([]);
  });

  it('o painel de antes — report só pelo nome, metric fixo — não exige nada', () => {
    const antigo: WidgetSpec = {
      type: 'grid',
      children: [{ type: 'report', report: 'acme-revenue' }, { type: 'metric', label: 'x', value: '10' }],
    };
    expect(packageWidgetDataIssues(pkg(antigo, '^2.0.0'))).toEqual([]);
  });

  it('o cartão do portal tem vocabulário próprio e fica de fora', () => {
    expect(packageWidgetDataIssues(pkg(painel, '^2.0.0', 'portal.view'))).toEqual([]);
  });
});

describe('o padrão do filtro de período da barra', () => {
  const comPadrao = (value: string | string[] | undefined): MarketplacePlugin => pkg({
    type: 'grid',
    children: [{
      type: 'filters',
      filters: [{ key: 'when', control: 'period', default: value }, { key: 'q', control: 'text', default: 'qualquer' }],
      children: [],
    }],
  }, `^${WIDGET_FILTER_CHOICE_SINCE_KERNEL}`);

  it('um período conhecido, ou nenhum padrão, passa', () => {
    expect(packageWidgetPeriodIssues(comPadrao('this-month'))).toEqual([]);
    expect(packageWidgetPeriodIssues(comPadrao('last-12-months'))).toEqual([]);
    expect(packageWidgetPeriodIssues(comPadrao(undefined))).toEqual([]);
    expect(packageWidgetPeriodIssues(comPadrao(''))).toEqual([]);
  });

  it('um período desconhecido é recusa na autoria, a qualquer profundidade, nomeando o filtro', () => {
    expect(packageWidgetPeriodIssues(comPadrao('last-12-meses'))).toEqual([{
      message: '@core.marketplace/issue.widget.period-default',
      messageParams: { contribution: 'sales', key: 'when', value: 'last-12-meses' },
    }]);
  });

  it('uma lista não é período — a barra pergunta um só', () => {
    expect(packageWidgetPeriodIssues(comPadrao(['this-month']))).toHaveLength(1);
  });

  it('periods: cada opção é período, e o padrão é um dos oferecidos', () => {
    const comPeriodos = (periods: string[], start?: string): MarketplacePlugin => pkg({
      type: 'filters',
      filters: [{ key: 'when', control: 'period', periods, ...(start ? { default: start } : {}) }],
      children: [],
    }, `^${WIDGET_PERIOD_RELATIVE_SINCE_KERNEL}`);

    expect(packageWidgetPeriodIssues(comPeriodos(['last-15-days', 'last-12-months'], 'last-12-months'))).toEqual([]);
    expect(packageWidgetPeriodIssues(comPeriodos(['last-12-months', 'ultimos-meses', 'last-12-months-offset-1'])))
      .toEqual(['ultimos-meses', 'last-12-months-offset-1'].map((value) => ({
        message: '@core.marketplace/issue.widget.period-option',
        messageParams: { contribution: 'sales', key: 'when', value },
      })));
    expect(packageWidgetPeriodIssues(comPeriodos(['last-12-months'], 'this-year'))).toEqual([{
      message: '@core.marketplace/issue.widget.period-default',
      messageParams: { contribution: 'sales', key: 'when', value: 'this-year' },
    }]);
  });

  it('o período parametrizado exige o kernel dele — o anterior abriria o painel sem recorte', () => {
    const parametrizado = (filter: WidgetFilter): WidgetSpec => ({ type: 'filters', filters: [filter], children: [] });
    for (const filter of [
      { key: 'when', control: 'period', default: 'last-12-months' },
      { key: 'when', control: 'period', periods: ['this-month', 'last-month'] },
    ] as WidgetFilter[]) {
      expect(packageWidgetDataIssues(pkg(parametrizado(filter), `^${WIDGET_FILTER_CHOICE_SINCE_KERNEL}`))).toEqual([{
        message: '@core.marketplace/issue.widget.data-kernel',
        messageParams: { contribution: 'sales', feature: 'filters.period.relative', minimum: WIDGET_PERIOD_RELATIVE_SINCE_KERNEL },
      }]);
      expect(packageWidgetDataIssues(pkg(parametrizado(filter), `^${WIDGET_PERIOD_RELATIVE_SINCE_KERNEL}`))).toEqual([]);
    }
    expect(packageWidgetDataIssues(pkg(parametrizado({ key: 'when', control: 'period', default: 'this-month' }), `^${WIDGET_DATA_SINCE_KERNEL}`)))
      .toEqual([]);
  });

  it('chega a quem valida o pacote', () => {
    expect(packageIssues(comPadrao('ultimos-12-meses')).map((issue) => issue.message))
      .toContain('@core.marketplace/issue.widget.period-default');
  });
});

const porCliente: WidgetSpec = {
  type: 'grid',
  children: [{
    type: 'filters',
    filters: [
      { key: 'client', control: 'record', collection: 'acme_clients' },
      { key: 'status', control: 'lookup', collection: 'acme_statuses', multi: false },
      { key: 'owner', control: 'record', collection: 'members' },
      { key: 'when', control: 'period' },
    ],
    children: [{ type: 'report', report: 'acme-revenue', bind: { client: 'client' } }],
  }],
};

describe('filtro de escolha na barra, no pacote', () => {
  it('o kernel da barra não basta: ali a escolha seria uma caixa de texto', () => {
    expect(packageWidgetDataIssues(pkg(porCliente, `^${WIDGET_DATA_SINCE_KERNEL}`))).toEqual([{
      message: '@core.marketplace/issue.widget.data-kernel',
      messageParams: { contribution: 'sales', feature: 'filters.record', minimum: WIDGET_FILTER_CHOICE_SINCE_KERNEL },
    }]);
    expect(packageWidgetDataIssues(pkg(porCliente, `^${WIDGET_FILTER_CHOICE_SINCE_KERNEL}`))).toEqual([]);
  });

  it('a coleção de onde a barra escolhe é referência — a do kernel não', () => {
    const from = { origin: WIDGET_REF_ORIGIN, name: 'sales' };
    expect(widgetOutRefs(pkg(porCliente, '^3.0.0'))).toEqual([
      { kind: 'screen', id: 'acme_clients', from },
      { kind: 'lookup', id: 'acme_statuses', from },
    ]);
    expect(widgetOutRefs(pkg(porCliente, '^3.0.0', 'portal.view'))).toEqual([]);
  });

  it('a tela que o pacote não leva nem declara é recusa', () => {
    const issues = validatePackage(pkg(porCliente, '^3.0.0'));
    expect(issues.map((issue) => issue.ref?.id)).toEqual(expect.arrayContaining(['acme_clients', 'acme_statuses']));
  });
});
