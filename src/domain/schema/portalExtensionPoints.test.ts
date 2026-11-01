import { describe, expect, it } from 'vitest';
import type { Contribution } from './plugin/contribution';
import { validateContribution } from './plugin/contribution';
import {
  PORTAL_EXTENSION_POINTS,
  PORTAL_VIEW_POINT,
  applyPortalPreference,
  asPortalViewMetadata,
  portalPageSpecsOf,
  portalViewsOf,
  portalWidgetSpecsOf,
} from './portalExtensionPoints';

describe('views de portal', () => {
  it('cada superfície exige o que a endereça — malformada é ausente, e a casca genérica continua', () => {
    expect(asPortalViewMetadata({ collection: 'invoices', surface: 'list' })).toEqual({ collection: 'invoices', surface: 'list' });
    expect(asPortalViewMetadata({ collection: 'invoices', surface: 'side' })).toBeNull();
    expect(asPortalViewMetadata({ surface: 'detail' })).toBeNull();
    expect(asPortalViewMetadata({ surface: 'page', title: 'x' })).toBeNull();
    expect(asPortalViewMetadata({ surface: 'page', key: 'statement', title: '@a/b', icon: 'file', order: 2 }))
      .toEqual({ surface: 'page', key: 'statement', title: '@a/b', icon: 'file', order: 2 });
    expect(asPortalViewMetadata({ surface: 'home', collection: 'ignored' })).toEqual({ surface: 'home' });
  });

  it('cada contribuição encontra a fonte que aponta; sem fonte, é descartada', () => {
    const contributions: Contribution[] = [
      { id: 'a', apiVersion: '1.0.0', point: PORTAL_VIEW_POINT, metadata: { collection: 'invoices', surface: 'list' }, impl: { kind: 'code', key: 'InvoiceList' } },
      { id: 'b', apiVersion: '1.0.0', point: PORTAL_VIEW_POINT, metadata: { collection: 'invoices', surface: 'detail' }, impl: { kind: 'code', key: 'Missing' } },
      { id: 'c', apiVersion: '1.0.0', point: 'ui.page', metadata: {}, impl: { kind: 'code', key: 'InvoiceList' } },
    ];
    const views = portalViewsOf('com.acme', contributions, [{ key: 'InvoiceList', source: 'export default () => null;' }]);
    expect(views).toEqual([{ pluginId: 'com.acme', viewKey: 'InvoiceList', collection: 'invoices', surface: 'list', source: 'export default () => null;' }]);
  });
});

describe('cartões da home declarados (`portalWidgetSpec`)', () => {
  const SPEC = { body: [{ type: 'count' as const, collection: 'invoices' }] };

  const declared = (metadata: Record<string, unknown>, spec: unknown = SPEC): Contribution => ({
    id: 'widget-due', apiVersion: '1.3.0', point: PORTAL_VIEW_POINT, metadata, impl: { kind: 'widget', spec: spec as Record<string, unknown> },
  });

  it('a contribuição de superfície `widget` vira cartão, com a entrada e a árvore', () => {
    expect(portalWidgetSpecsOf('com.acme', [declared({ surface: 'widget', key: 'due', title: '@acme/due', order: 5 })]))
      .toEqual([{ pluginId: 'com.acme', key: 'due', title: '@acme/due', order: 5, spec: SPEC }]);
  });

  it('a de outra superfície, a de código e a árvore vazia não viram cartão', () => {
    const contributions: Contribution[] = [
      { id: 'a', apiVersion: '1.0.0', point: PORTAL_VIEW_POINT, metadata: { surface: 'page', key: 'p' }, impl: { kind: 'widget', spec: SPEC } },
      { id: 'b', apiVersion: '1.0.0', point: PORTAL_VIEW_POINT, metadata: { surface: 'widget', key: 'w' }, impl: { kind: 'code', key: 'W' } },
      { id: 'c', apiVersion: '1.0.0', point: PORTAL_VIEW_POINT, metadata: { surface: 'widget', key: 'e' }, impl: { kind: 'widget', spec: { body: [] } } },
    ];
    expect(portalWidgetSpecsOf('com.acme', contributions)).toEqual([]);
    expect(portalViewsOf('com.acme', [contributions[0]], [])).toEqual([]);
  });

  it('extensão sem confiança de código declara o cartão — e continua sem poder trazer código', () => {
    const point = PORTAL_EXTENSION_POINTS[0];
    const diagnostics = validateContribution(declared({ surface: 'widget', key: 'due' }), { pluginId: 'com.acme', trusted: false, point });
    expect(diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
    const code = validateContribution(
      { id: 'w', apiVersion: '1.3.0', point: PORTAL_VIEW_POINT, metadata: { surface: 'widget', key: 'w' }, impl: { kind: 'code', key: 'W' } },
      { pluginId: 'com.acme', trusted: false, point },
    );
    expect(code.map((diagnostic) => diagnostic.message)).toContain('@core.marketplace/diagnostic.contribution.impl.trusted-only');
  });
});

describe('a ordem do escritório', () => {
  const entries = [{ id: 'a', order: 3 }, { id: 'b' }, { id: 'c', order: 1 }, { id: 'd', order: 2 }];

  it('o que ele ordenou vem primeiro; o resto segue a ordem sugerida; o escondido sai', () => {
    expect(applyPortalPreference(entries, { order: ['b', 'ghost'], hidden: ['d'] }).map((entry) => entry.id))
      .toEqual(['b', 'c', 'a']);
  });

  it('entrada nova aparece — esconder é gesto, não padrão', () => {
    expect(applyPortalPreference(entries, { order: [], hidden: [] }).map((entry) => entry.id)).toEqual(['c', 'd', 'a', 'b']);
  });
});

describe('páginas do menu declaradas (`portalPageSpec`)', () => {
  const SPEC = { body: [{ type: 'markdown' as const, content: '@br.gov.dte.legislacao/portal.legislacao' }] };

  const declared = (metadata: Record<string, unknown>, impl: Contribution['impl'] = { kind: 'widget', spec: SPEC }): Contribution => ({
    id: 'page-law', apiVersion: '1.3.0', point: PORTAL_VIEW_POINT, metadata, impl,
  });

  it('a contribuição de superfície `page` com implementação declarada vira página, com o ícone e a árvore', () => {
    expect(portalPageSpecsOf('com.acme', [declared({ surface: 'page', key: 'law', title: '@acme/law', icon: 'book', order: 3 })]))
      .toEqual([{ pluginId: 'com.acme', key: 'law', title: '@acme/law', icon: 'book', order: 3, spec: SPEC }]);
  });

  it('a de código, a de outra superfície e a árvore vazia não viram página — e o cartão não vira página', () => {
    expect(portalPageSpecsOf('com.acme', [
      declared({ surface: 'page', key: 'code' }, { kind: 'code', key: 'Law' }),
      declared({ surface: 'widget', key: 'card' }),
      declared({ surface: 'page', key: 'empty' }, { kind: 'widget', spec: { body: [] } }),
    ])).toEqual([]);
    expect(portalWidgetSpecsOf('com.acme', [declared({ surface: 'page', key: 'law' })])).toEqual([]);
  });

  it('extensão sem confiança de código declara a página', () => {
    const point = PORTAL_EXTENSION_POINTS[0];
    const diagnostics = validateContribution(declared({ surface: 'page', key: 'law' }), { pluginId: 'com.acme', trusted: false, point });
    expect(diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toEqual([]);
  });
});
