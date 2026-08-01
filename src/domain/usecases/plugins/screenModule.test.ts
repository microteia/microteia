import { describe, it, expect } from 'vitest';
import type { MarketplacePlugin, ScreenModuleTemplate } from '../../entities/MarketplacePlugin';
import type { ScreenDefinition } from '../../entities';
import { buildScreenKeyMap, installedScreenKey, materializePluginScreens, materializeScreen } from './screenModule';

const template: ScreenModuleTemplate = {
  key: 'venda',
  titleSingular: 'Venda',
  titlePlural: 'Vendas',
  icon: 'shoppingBag',
  titleFieldKey: 'numero',
  fields: [
    { key: 'numero', label: 'Número', type: 'text', required: true, order: 0 },
    { key: 'cliente', label: 'Cliente', type: 'reference', refEntity: 'contracts', required: true, order: 1 },
    {
      key: 'total', label: 'Total', type: 'currency', required: false, order: 2,
      aggregation: { from: 'item', via: 'venda', op: 'sum', field: 'total' },
    },
  ],
};

describe('installedScreenKey', () => {
  it('usa a chave declarada no pacote — ela é o nome da coleção', () => {
    expect(installedScreenKey('produtos')).toBe('produtos');
  });

  it('desambigua com sufixo quando o nome já está ocupado no escritório', () => {
    expect(installedScreenKey('produtos', new Set(['produtos']))).toBe('produtos_2');
    expect(installedScreenKey('produtos', new Set(['produtos', 'produtos_2']))).toBe('produtos_3');
  });

  it('nome reservado pelo sistema nunca é reivindicado', () => {
    expect(installedScreenKey('contracts')).toBe('contracts_2');
    expect(installedScreenKey('notes')).toBe('notes_2');
  });

  it('chave ilegal como nome de coleção é normalizada, nunca gravada como veio', () => {
    expect(installedScreenKey('com-acme-vendas__produto')).toBe('com_acme_vendas_produto');
  });
});

describe('buildScreenKeyMap', () => {
  it('mapeia cada key de template para a própria chave declarada', () => {
    const map = buildScreenKeyMap([template, { ...template, key: 'item' }]);
    expect(map.get('venda')).toBe('venda');
    expect(map.get('item')).toBe('item');
  });

  it('reusa a chave da tela existente de mesmo sourceId, mesmo sendo uma chave longa antiga', () => {
    const existing = { id: 'com-acme-vendas__venda', sourceId: 'src-venda', fields: [] } as unknown as ScreenDefinition;
    const map = buildScreenKeyMap([{ ...template, sourceId: 'src-venda' }], [existing]);
    expect(map.get('venda')).toBe('com-acme-vendas__venda');
  });

  it('tela do escritório com a mesma chave e outro sourceId não é tomada: sufixo', () => {
    const existing = { id: 'venda', sourceId: 'outra-tela', fields: [] } as unknown as ScreenDefinition;
    const map = buildScreenKeyMap([{ ...template, sourceId: 'src-venda' }], [existing]);
    expect(map.get('venda')).toBe('venda_2');
  });

  it('lista de opções e etiquetas do escritório também ocupam o nome', () => {
    const map = buildScreenKeyMap([template], [], new Set(['venda']));
    expect(map.get('venda')).toBe('venda_2');
  });

  it('a chave que uma tela do pacote acabou de reivindicar não é dada a outra', () => {
    const map = buildScreenKeyMap([template, { ...template, key: 'venda_2' }], [], new Set(['venda']));
    expect(map.get('venda')).toBe('venda_2');
    expect(map.get('venda_2')).toBe('venda_2_2');
  });
});

describe('materializeScreen', () => {
  const keyMap = new Map([
    ['venda', 'venda'],
    ['item', 'item'],
  ]);

  it('carimba origin plugin na tela e nos campos, com ownerPluginId e managed', () => {
    const { input } = materializeScreen(template, 'com.acme.vendas', keyMap, 'u1');
    expect(input.ownerPluginId).toBe('com.acme.vendas');
    expect(input.managed).toBe(true);
    expect(input.origin).toBe('plugin');
    expect(input.createdBy).toBe('u1');
    expect(input.fields.every((f) => f.ownerPluginId === 'com.acme.vendas')).toBe(true);
    expect(input.fields.every((f) => f.origin === 'plugin')).toBe(true);
  });

  it('reescreve aggregation.from para a tela do pacote e preserva ref ao core', () => {
    const { input } = materializeScreen(template, 'com.acme.vendas', keyMap, 'u1');
    expect(input.fields.find((f) => f.key === 'cliente')?.refEntity).toBe('contracts');
    expect(input.fields.find((f) => f.key === 'total')?.aggregation?.from).toBe('item');
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
    expect(screenKey).toBe('item');
    expect(input.parentEntity).toBe('venda');
    expect(input.parentFieldKey).toBe('venda');
    expect(input.fields[0].refEntity).toBe('venda');
  });

  it('não emite nenhum undefined (o Firestore o rejeita, inclusive dentro de fields)', () => {
    const hasUndefined = (value: unknown): boolean => {
      if (Array.isArray(value)) return value.some(hasUndefined);
      if (value !== null && typeof value === 'object') {
        return Object.values(value).some((v) => v === undefined || hasUndefined(v));
      }
      return value === undefined;
    };
    const { input } = materializeScreen(template, 'com.acme.vendas', keyMap, 'u1');
    // campos sem refEntity/aggregation não podem carregar essas chaves como undefined
    expect(hasUndefined(input)).toBe(false);
    const numero = input.fields.find((f) => f.key === 'numero')!;
    expect('refEntity' in numero && numero.refEntity === undefined).toBe(false);
    expect('aggregation' in numero && numero.aggregation === undefined).toBe(false);
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

describe('tela ligada a uma coleção existente (dataCollection)', () => {
  it('preserva a coleção alvo verbatim — é o nome universal da entidade, não uma tela do pacote', () => {
    const keyMap = new Map([['venda', 'venda']]);
    const bound: ScreenModuleTemplate = { ...template, dataCollection: 'cases', fields: [] };
    const { input } = materializeScreen(bound, 'com.acme.vendas', keyMap, 'u1');
    expect(input.dataCollection).toBe('cases');
  });

  it('tela comum não ganha vínculo nenhum', () => {
    const keyMap = new Map([['venda', 'venda']]);
    const { input } = materializeScreen(template, 'com.acme.vendas', keyMap, 'u1');
    expect(input.dataCollection).toBeNull();
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
    expect(result.map((r) => r.screenKey)).toEqual(['venda', 'item']);
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
