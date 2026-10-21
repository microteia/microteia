import { describe, expect, it } from 'vitest';
import type { Contribution } from './plugin/contribution';
import { PORTAL_VIEW_POINT, applyPortalPreference, asPortalViewMetadata, portalViewsOf } from './portalExtensionPoints';

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
