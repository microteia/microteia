import { describe, it, expect } from 'vitest';
import { tenantExtensionRecords } from './tenantExtensionRecords';
import type { TenantExtension } from '../../entities/TenantExtension';

const ext = (over: Partial<TenantExtension> & { id: string }): TenantExtension => ({
  tenantId: 't1',
  active: true,
  createdBy: 'u1',
  createdAt: new Date(),
  updatedAt: new Date(),
  package: { manifest: { id: over.id, version: '1.0.0', kernel: '^1.0.0', name: over.id }, summary: '', workflows: [] },
  ...over,
});

describe('tenantExtensionRecords', () => {
  it('extensão ativa com views vira record trusted + ExtensionViewRef (self-trust do próprio tenant)', () => {
    const withView = ext({
      id: 'com.acme.kanban',
      package: {
        manifest: { id: 'com.acme.kanban', version: '1.0.0', kernel: '^1.0.0', name: 'Kanban' },
        summary: '', workflows: [],
        views: [{ key: 'kanban', title: 'Kanban', icon: 'layoutGrid', source: 'export default () => null;' }],
      },
    });
    const records = tenantExtensionRecords([withView]);
    expect(records).toHaveLength(1);
    expect(records[0].trusted).toBe(true);
    expect(records[0].implementations?.kanban).toMatchObject({ kind: 'extension-view', pluginId: 'com.acme.kanban' });
  });

  it('extensão INATIVA não gera record', () => {
    expect(tenantExtensionRecords([ext({ id: 'com.acme.x', active: false })])).toEqual([]);
  });

  it('extensão ativa sem views é não-confiável e sem implementations', () => {
    const records = tenantExtensionRecords([ext({ id: 'com.acme.y' })]);
    expect(records[0].trusted).toBe(false);
    expect(records[0].implementations).toBeUndefined();
  });
});
