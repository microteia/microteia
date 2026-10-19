import { describe, expect, it } from 'vitest';
import type { Contribution } from './plugin/contribution';
import { PORTAL_VIEW_POINT, asPortalViewMetadata, portalViewsOf } from './portalExtensionPoints';

describe('views de portal', () => {
  it('metadata malformada é ausente — a casca genérica continua', () => {
    expect(asPortalViewMetadata({ collection: 'invoices', surface: 'list' })).toEqual({ collection: 'invoices', surface: 'list' });
    expect(asPortalViewMetadata({ collection: 'invoices', surface: 'side' })).toBeNull();
    expect(asPortalViewMetadata({ surface: 'detail' })).toBeNull();
  });

  it('cada contribuição encontra a fonte que aponta; sem fonte, é descartada', () => {
    const contributions: Contribution[] = [
      { id: 'a', apiVersion: '1.0.0', point: PORTAL_VIEW_POINT, metadata: { collection: 'invoices', surface: 'list' }, impl: { kind: 'code', key: 'InvoiceList' } },
      { id: 'b', apiVersion: '1.0.0', point: PORTAL_VIEW_POINT, metadata: { collection: 'invoices', surface: 'detail' }, impl: { kind: 'code', key: 'Missing' } },
      { id: 'c', apiVersion: '1.0.0', point: 'ui.page', metadata: {}, impl: { kind: 'code', key: 'InvoiceList' } },
    ];
    const views = portalViewsOf('com.acme', contributions, [{ key: 'InvoiceList', source: 'export default () => null;' }]);
    expect(views).toEqual([{ pluginId: 'com.acme', key: 'InvoiceList', collection: 'invoices', surface: 'list', source: 'export default () => null;' }]);
  });
});
