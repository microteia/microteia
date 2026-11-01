import { describe, expect, it } from 'vitest';
import { portalWidgetSpec, validatePluginPackage, PORTAL_WIDGET_SPEC_SINCE_KERNEL } from './index';
import type { MarketplacePlugin, PortalWidgetSpec } from './index';
import { PORTAL_EXTENSION_POINTS, portalWidgetSpecsOf } from '../domain/schema/portalExtensionPoints';
import { validateContribution } from '../domain/schema/plugin/contribution';

const DUE: PortalWidgetSpec = {
  body: [
    { type: 'count', collection: 'notices', when: 'status == "open"' },
    {
      type: 'records',
      collection: 'notices',
      when: 'status == "open"',
      orderBy: { field: 'deadline' },
      empty: '@com.acme.notices/portal.none',
      card: [{ type: 'title' }, { type: 'field', field: 'deadline', label: true }],
    },
  ],
};

const notices = (spec: PortalWidgetSpec, kernel = `^${PORTAL_WIDGET_SPEC_SINCE_KERNEL}`): MarketplacePlugin => ({
  summary: 'Notices for the guests.',
  manifest: {
    id: 'com.acme.notices',
    version: '1.0.0',
    kernel,
    name: 'Notices',
    contributes: [portalWidgetSpec({ key: 'due', title: '@com.acme.notices/portal.due', order: 1 }, spec)],
  },
  workflows: [],
  screens: [{
    key: 'notices',
    titleSingular: 'Notice',
    titlePlural: 'Notices',
    icon: 'mail',
    titleFieldKey: 'subject',
    fields: [
      { key: 'subject', label: 'Subject', type: 'text', required: true, order: 0 },
      { key: 'status', label: 'Status', type: 'text', required: false, order: 1 },
      { key: 'deadline', label: 'Deadline', type: 'date', required: false, order: 2 },
      { key: 'riskScore', label: 'Risk', type: 'number', required: false, order: 3 },
    ],
    portal: { subject: 'self', fields: ['subject', 'status', 'deadline'] },
  }],
});

const portalIssues = (pkg: MarketplacePlugin) =>
  validatePluginPackage(pkg).filter((issue) => issue.message.includes('portal'));

describe('portalWidgetSpec — o cartão da home declarado, pela porta única de validação', () => {
  it('o pacote que só lê o exposto, com o kernel que o desenha, passa', () => {
    expect(portalIssues(notices(DUE))).toEqual([]);
  });

  it('o construtor escreve o que o servidor lê, e um pacote sem confiança de código pode contribuí-lo', () => {
    const [contribution] = notices(DUE).manifest.contributes ?? [];
    expect(portalWidgetSpecsOf('com.acme.notices', [contribution])).toEqual([
      { pluginId: 'com.acme.notices', key: 'due', title: '@com.acme.notices/portal.due', order: 1, spec: DUE },
    ]);
    const diagnostics = validateContribution(contribution, { pluginId: 'com.acme.notices', trusted: false, point: PORTAL_EXTENSION_POINTS[0] });
    expect(diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
  });

  it('o kernel anterior é recusa: ele descartaria a contribuição, e o cartão só faltaria na home', () => {
    expect(portalIssues(notices(DUE, '^2.80.0'))).toEqual([{
      source: 'package',
      message: '@core.marketplace/issue.portal.widget.kernel',
      messageParams: { id: 'widget-due', minimum: PORTAL_WIDGET_SPEC_SINCE_KERNEL },
    }]);
  });

  it('o campo que não sai da tela do próprio pacote é recusa, com o caminho no manifest', () => {
    const issues = portalIssues(notices({ body: [{ type: 'count', collection: 'notices', when: 'riskScore > 700' }] }));
    expect(issues).toEqual([{
      source: 'package',
      message: '@core.records/portal-template.issue.expression-unexposed',
      messageParams: { where: 'manifest.contributes[0].impl.spec.body[0].when', field: 'riskScore' },
    }]);
  });

  it('a superfície errada é recusa: a declaração é cartão da home ou página do menu, e a home inteira é código', () => {
    const pkg = notices(DUE);
    const [contribution] = pkg.manifest.contributes ?? [];
    const onHome = { ...pkg, manifest: { ...pkg.manifest, contributes: [{ ...contribution, metadata: { surface: 'home' } }] } };
    expect(portalIssues(onHome)).toEqual([{
      source: 'package',
      message: '@core.marketplace/issue.portal.widget.surface',
      messageParams: { id: 'widget-due' },
    }]);
  });
});
