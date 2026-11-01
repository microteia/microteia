import { describe, expect, it } from 'vitest';
import {
  PORTAL_PAGE_SPEC_SINCE_KERNEL,
  PORTAL_WIDGET_SPEC_SINCE_KERNEL,
  messageBundleContribution,
  portalPageSpec,
  portalWidgetSpec,
  validatePluginPackage,
} from './index';
import type { Contribution, MarketplacePlugin, PortalPageSpec } from './index';
import { PORTAL_EXTENSION_POINTS, portalPageSpecsOf } from '../domain/schema/portalExtensionPoints';
import { validateContribution } from '../domain/schema/plugin/contribution';
import { KERNEL_VERSION } from '../domain/schema/plugin/kernelVersion';

const LAW = '@br.com.microteia.dte.legislacao/portal.legislacao';
const HELP = '@com.acme.portal/portal.help';

const LEGISLATION: PortalPageSpec = { body: [{ type: 'markdown', content: LAW }] };

const portalPackage = (contributes: Contribution[], kernel = `^${PORTAL_PAGE_SPEC_SINCE_KERNEL}`): MarketplacePlugin => ({
  summary: 'The portal pages.',
  manifest: { id: 'com.acme.portal', version: '1.0.0', kernel, name: 'Portal', contributes },
  workflows: [],
});

const portalIssues = (pkg: MarketplacePlugin) =>
  validatePluginPackage(pkg).filter((issue) => issue.message.includes('portal'));

describe('portalPageSpec — a página do menu declarada, pela porta única de validação', () => {
  it('o kernel que a desenha é o atual', () => {
    expect(PORTAL_PAGE_SPEC_SINCE_KERNEL).toBe(KERNEL_VERSION);
  });

  it('a página cujo texto vem de OUTRO namespace passa — quem traz a lei é o pacote do município', () => {
    const pkg = portalPackage([portalPageSpec({ key: 'legislation', title: '@com.acme.portal/portal.legislation', icon: 'book', order: 1 }, LEGISLATION)]);
    expect(portalIssues(pkg)).toEqual([]);
  });

  it('o pacote que só traz o texto é um pacote de mensagens, e também passa', () => {
    const law: MarketplacePlugin = {
      summary: 'The law of the city.',
      manifest: {
        id: 'br.com.microteia.dte.legislacao.salvador',
        version: '1.0.0',
        kernel: '^2.0.0',
        name: 'Legislação — Salvador',
        contributes: [messageBundleContribution({ locale: 'pt-BR', namespace: 'br.com.microteia.dte.legislacao', messages: { 'portal.legislacao': '# Lei 1/2026' } })],
      },
      workflows: [],
    };
    expect(validatePluginPackage(law)).toEqual([]);
  });

  it('o construtor escreve o que o servidor lê, e um pacote sem confiança de código pode contribuí-la', () => {
    const contribution = portalPageSpec({ key: 'legislation', title: '@com.acme.portal/portal.legislation', icon: 'book', order: 1 }, LEGISLATION);
    expect(contribution).toMatchObject({ id: 'page-legislation', impl: { kind: 'widget' }, metadata: { surface: 'page' } });
    expect(portalPageSpecsOf('com.acme.portal', [contribution])).toEqual([
      { pluginId: 'com.acme.portal', key: 'legislation', title: '@com.acme.portal/portal.legislation', icon: 'book', order: 1, spec: LEGISLATION },
    ]);
    const diagnostics = validateContribution(contribution, { pluginId: 'com.acme.portal', trusted: false, point: PORTAL_EXTENSION_POINTS[0] });
    expect(diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
  });

  it('a página, e o markdown num cartão, pedem o kernel que os desenha', () => {
    expect(portalIssues(portalPackage([portalPageSpec({ key: 'legislation' }, LEGISLATION)], `^${PORTAL_WIDGET_SPEC_SINCE_KERNEL}`))).toEqual([{
      source: 'package',
      message: '@core.marketplace/issue.portal.widget.kernel',
      messageParams: { id: 'page-legislation', minimum: PORTAL_PAGE_SPEC_SINCE_KERNEL },
    }]);
    expect(portalIssues(portalPackage([
      portalWidgetSpec({ key: 'count' }, { body: [{ type: 'text', text: 'x' }] }),
      portalWidgetSpec({ key: 'notice' }, { body: [{ type: 'markdown', content: HELP }] }),
    ], `^${PORTAL_WIDGET_SPEC_SINCE_KERNEL}`))).toEqual([{
      source: 'package',
      message: '@core.marketplace/issue.portal.widget.kernel',
      messageParams: { id: 'widget-notice', minimum: PORTAL_PAGE_SPEC_SINCE_KERNEL },
    }]);
  });

  it('o cartão sem markdown continua pedindo só o kernel do cartão', () => {
    expect(portalIssues(portalPackage([portalWidgetSpec({ key: 'note' }, { body: [{ type: 'text', text: 'x' }] })], `^${PORTAL_WIDGET_SPEC_SINCE_KERNEL}`)))
      .toEqual([]);
  });

  it('o texto solto no markdown é recusa — não traduz, e o escritório não teria o que editar', () => {
    expect(portalIssues(portalPackage([portalPageSpec({ key: 'help' }, { body: [{ type: 'markdown', content: '# Help' }] })]))).toEqual([{
      source: 'package',
      message: '@core.records/portal-widget.issue.markdown-content',
      messageParams: { where: 'manifest.contributes[0].impl.spec.body[0].content' },
    }]);
  });
});
