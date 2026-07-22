import { describe, it, expect } from 'vitest';
import type { ExtensionPointDefinition } from '../domain/schema/plugin/extensionPoint';
import { createExtensionPointRegistry } from './ExtensionPointRegistry';

const point = (overrides: Partial<ExtensionPointDefinition> = {}): ExtensionPointDefinition => ({
  id: 'ui.page',
  apiVersion: '1.0.0',
  title: 'Página',
  ownerPluginId: 'core.ui',
  allowedImplKinds: ['code', 'widget'],
  implRequired: true,
  multiple: true,
  ...overrides,
});

describe('createExtensionPointRegistry', () => {
  it('começa vazio', () => {
    const registry = createExtensionPointRegistry();
    expect(registry.list()).toEqual([]);
    expect(registry.has('ui.page')).toBe(false);
    expect(registry.get('ui.page')).toBeUndefined();
  });

  it('registra e recupera um ponto', () => {
    const registry = createExtensionPointRegistry();
    expect(registry.register(point())).toEqual([]);
    expect(registry.get('ui.page')?.title).toBe('Página');
    expect(registry.has('ui.page')).toBe(true);
  });

  it('lista em ordem alfabética, não de registro', () => {
    const registry = createExtensionPointRegistry();
    registry.register(point({ id: 'ui.widget' }));
    registry.register(point({ id: 'data.entity' }));
    registry.register(point({ id: 'ui.nav' }));

    expect(registry.list().map((p) => p.id)).toEqual(['data.entity', 'ui.nav', 'ui.widget']);
  });

  it('deixa o dono redeclarar o próprio ponto (recarga)', () => {
    const registry = createExtensionPointRegistry();
    registry.register(point());
    expect(registry.register(point({ apiVersion: '1.1.0' }))).toEqual([]);
    expect(registry.get('ui.page')?.apiVersion).toBe('1.1.0');
  });

  it('recusa outro plugin sequestrar um ponto já declarado', () => {
    const registry = createExtensionPointRegistry();
    registry.register(point());
    const diagnostics = registry.register(point({ ownerPluginId: 'com.evil.x' }));

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: 'extensionPoint.duplicate',
      severity: 'error',
      pluginId: 'com.evil.x',
    });
    expect(registry.get('ui.page')?.ownerPluginId).toBe('core.ui');
  });

  it('snapshot é uma cópia independente', () => {
    const registry = createExtensionPointRegistry();
    registry.register(point());
    const snapshot = registry.snapshot();
    registry.register(point({ id: 'ui.nav' }));

    expect(snapshot.size).toBe(1);
    expect(registry.list()).toHaveLength(2);
  });

  it('removeByPlugin tira só os pontos do dono', () => {
    const registry = createExtensionPointRegistry();
    registry.register(point({ id: 'ui.page' }));
    registry.register(point({ id: 'ui.nav' }));
    registry.register(point({ id: 'acme.slot', ownerPluginId: 'com.acme.x' }));

    expect(registry.removeByPlugin('core.ui')).toBe(2);
    expect(registry.list().map((p) => p.id)).toEqual(['acme.slot']);
    expect(registry.removeByPlugin('inexistente')).toBe(0);
  });

  it('clear zera tudo', () => {
    const registry = createExtensionPointRegistry();
    registry.register(point());
    registry.clear();
    expect(registry.list()).toEqual([]);
  });
});
