import { describe, it, expect } from 'vitest';
import type { MarketplacePlugin, ScreenModuleTemplate } from '../../entities/MarketplacePlugin';
import { buildScreenKeyMap, installedScreenKey, materializePluginScreens, materializeScreen } from './screenModule';

const template: ScreenModuleTemplate = {
  key: 'venda',
  titleSingular: 'Venda',
  titlePlural: 'Vendas',
  icon: 'shoppingBag',
  titleFieldKey: 'numero',
  fields: [
    { key: 'numero', label: 'Número', type: 'text', required: true, order: 0 },
    { key: 'cliente', label: 'Cliente', type: 'reference', refEntity: 'persons', required: true, order: 1 },
    {
      key: 'total', label: 'Total', type: 'currency', required: false, order: 2,
      aggregation: { from: 'item', via: 'venda', op: 'sum', field: 'total' },
    },
  ],
};

describe('installedScreenKey', () => {
  it('namespaceia por plugin, com customRecords legível', () => {
    expect(installedScreenKey('com.acme.vendas', 'produto')).toBe('com-acme-vendas__produto');
  });

  it('duas extensões com a mesma key de template não colidem', () => {
    expect(installedScreenKey('com.a.x', 'produto')).not.toBe(installedScreenKey('com.b.y', 'produto'));
  });
});

describe('buildScreenKeyMap', () => {
  it('mapeia cada key de template para a chave instalada', () => {
    const map = buildScreenKeyMap('com.acme.vendas', [template, { ...template, key: 'item' }]);
    expect(map.get('venda')).toBe('com-acme-vendas__venda');
    expect(map.get('item')).toBe('com-acme-vendas__item');
  });
});

describe('materializeScreen', () => {
  const keyMap = new Map([
    ['venda', 'com-acme-vendas__venda'],
    ['item', 'com-acme-vendas__item'],
  ]);

  it('marca a tela e os campos com ownerPluginId e managed', () => {
    const { input } = materializeScreen(template, 'com.acme.vendas', keyMap, 'u1');
    expect(input.ownerPluginId).toBe('com.acme.vendas');
    expect(input.managed).toBe(true);
    expect(input.builtin).toBe(false);
    expect(input.createdBy).toBe('u1');
    expect(input.fields.every((f) => f.ownerPluginId === 'com.acme.vendas')).toBe(true);
  });

  it('reescreve aggregation.from para a tela do pacote e preserva ref ao core', () => {
    const { input } = materializeScreen(template, 'com.acme.vendas', keyMap, 'u1');
    expect(input.fields.find((f) => f.key === 'cliente')?.refEntity).toBe('persons');
    expect(input.fields.find((f) => f.key === 'total')?.aggregation?.from).toBe('com-acme-vendas__item');
  });

  it('reescreve refEntity e parentEntity que apontam para o pacote', () => {
    const item: ScreenModuleTemplate = {
      key: 'item',
      titleSingular: 'Item',
      titlePlural: 'Itens',
      icon: 'x',
      titleFieldKey: 'produto',
      parentEntity: 'venda',
      parentFieldKey: 'venda',
      fields: [{ key: 'venda', label: 'Venda', type: 'reference', refEntity: 'venda', required: true, order: 0 }],
    };
    const { screenKey, input } = materializeScreen(item, 'com.acme.vendas', keyMap, 'u1');
    expect(screenKey).toBe('com-acme-vendas__item');
    expect(input.parentEntity).toBe('com-acme-vendas__venda');
    expect(input.parentFieldKey).toBe('venda');
    expect(input.fields[0].refEntity).toBe('com-acme-vendas__venda');
  });

  it('não altera refEntity para coleção fora do pacote', () => {
    const withExternal: ScreenModuleTemplate = {
      ...template,
      fields: [{ key: 'proc', label: 'Processo', type: 'reference', refEntity: 'cases', required: false, order: 0 }],
    };
    const { input } = materializeScreen(withExternal, 'com.acme.vendas', keyMap, 'u1');
    expect(input.fields[0].refEntity).toBe('cases');
  });
});

describe('materializePluginScreens', () => {
  it('materializa todas as telas do plugin', () => {
    const plugin: MarketplacePlugin = {
      summary: '',
      manifest: { id: 'com.acme.vendas', version: '1.0.0', kernel: '^1.0.0', name: 'V' },
      workflows: [],
      screens: [template, { ...template, key: 'item' }],
    };
    const result = materializePluginScreens(plugin, 'u1');
    expect(result.map((r) => r.screenKey)).toEqual(['com-acme-vendas__venda', 'com-acme-vendas__item']);
  });

  it('plugin sem telas devolve vazio', () => {
    const plugin: MarketplacePlugin = {
      summary: '',
      manifest: { id: 'com.acme.x', version: '1.0.0', kernel: '^1.0.0', name: 'X' },
      workflows: [],
    };
    expect(materializePluginScreens(plugin, 'u1')).toEqual([]);
  });
});
