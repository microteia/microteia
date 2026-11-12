import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { WIDGET_DATA_SINCE_KERNEL } from '../../schema/ui/widgetSpec';
import type { WidgetSpec } from '../../schema/ui/widgetSpec';
import { packageWidgetDataIssues } from './pluginWidgetData';

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
