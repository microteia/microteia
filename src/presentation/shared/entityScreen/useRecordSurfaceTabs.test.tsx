// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { ContributionLayoutEntry } from '../../../domain/schema/settings';
import type { RecordTabCatalogItem } from '../settings/useRecordTabCatalog';

const state: {
  sourceIds: string[];
  catalog: RecordTabCatalogItem[];
  entries: ContributionLayoutEntry[];
  granted: string[];
} = { sourceIds: [], catalog: [], entries: [], granted: [] };

vi.mock('../settings/useRecordTabCatalog', () => ({
  useRecordTabLayout: (sourceId: string) => {
    state.sourceIds.push(sourceId);
    return { catalog: state.catalog, entries: state.entries };
  },
}));
vi.mock('../../../stores/useAuthorization', () => ({
  useAuthorization: () => ({
    can: (permission: string) => state.granted.includes(permission),
    canAny: (permissions: string[]) => permissions.some((permission) => state.granted.includes(permission)),
  }),
}));
vi.mock('../../components/layout/ChildRecordList', () => ({ ChildRecordList: () => null }));
vi.mock('../../components/layout/RecordSurfaceTab', () => ({ RecordSurfaceTab: () => null }));

const { useRecordSurfaceTabs } = await import('./useRecordSurfaceTabs');

const child = (id: string, overrides: Record<string, unknown> = {}): RecordTabCatalogItem => ({
  key: `child:${id}`,
  title: id,
  pluginId: '',
  order: 0,
  childScreen: { id, parentFieldKey: 'processo', ...overrides } as never,
  tab: null,
});

const contributed = (key: string, requiredPermissions?: string[]): RecordTabCatalogItem => ({
  key,
  title: key,
  pluginId: 'com.microteia.prazo',
  order: 0,
  childScreen: null,
  tab: { key, title: key, surface: 'record:microteia:processo', pluginId: 'com.microteia.prazo', requiredPermissions } as never,
});

const tabs = (record: { id: string } | null = { id: 'p1' }) => renderHook(() => useRecordSurfaceTabs({
  screenSourceId: 'microteia:processo', collection: 'processos', record,
})).result.current;

beforeEach(() => {
  state.sourceIds = [];
  state.catalog = [child('anexos'), contributed('prazos'), contributed('movimentacoes')];
  state.entries = [
    { key: 'child:anexos', enabled: true },
    { key: 'prazos', enabled: true },
    { key: 'movimentacoes', enabled: true },
  ];
  state.granted = ['anexos.read'];
});

/**
 * Tela-filha e aba contribuída são UMA faixa: a ordem e o liga/desliga vêm da mesma configuração, e
 * o escritório pode pôr uma entre as outras.
 */
describe('a faixa de abas do detalhe de um registro', () => {
  it('lê a configuração pelo sourceId da tela, e não pela chave instalada', () => {
    tabs();
    expect(state.sourceIds).toContain('microteia:processo');
  });

  it('segue a ordem escolhida, misturando tela-filha e aba contribuída', () => {
    state.entries = [
      { key: 'prazos', enabled: true },
      { key: 'child:anexos', enabled: true },
      { key: 'movimentacoes', enabled: true },
    ];
    expect(tabs().map((tab) => tab.key)).toEqual(['surface:prazos', 'child:anexos', 'surface:movimentacoes']);
  });

  it('desligar vale para as duas origens', () => {
    state.entries = [
      { key: 'child:anexos', enabled: false },
      { key: 'prazos', enabled: true },
      { key: 'movimentacoes', enabled: false },
    ];
    expect(tabs().map((tab) => tab.key)).toEqual(['surface:prazos']);
  });

  /**
   * A aba de filhos é a terceira porta para a mesma tela — depois do menu e do ⌘K. Uma aba que só
   * pode mostrar vazio promete registros que a regra do servidor nunca vai entregar.
   */
  it('sem permissão de ler a coleção da filha, a aba dela não existe', () => {
    state.granted = [];
    expect(tabs().map((tab) => tab.key)).toEqual(['surface:prazos', 'surface:movimentacoes']);
  });

  it('a permissão cobrada é da COLEÇÃO da tela-filha, não da chave dela', () => {
    state.catalog = [child('anexos', { dataCollection: 'attachments' })];
    state.entries = [{ key: 'child:anexos', enabled: true }];
    expect(tabs()).toEqual([]);
    state.granted = ['attachments.read'];
    expect(tabs().map((tab) => tab.key)).toEqual(['child:anexos']);
  });

  it('a aba contribuída pede o que declarou, e uma permissão basta', () => {
    state.catalog = [contributed('prazos', ['prazos.read', 'prazos.manage'])];
    state.entries = [{ key: 'prazos', enabled: true }];
    expect(tabs()).toEqual([]);
    state.granted = ['prazos.manage'];
    expect(tabs().map((tab) => tab.key)).toEqual(['surface:prazos']);
  });

  it('entrega à view contribuída o registro aberto, a coleção e a tela', () => {
    const record = { id: 'p1', numero: '0001' };
    const prazos = tabs(record).find((tab) => tab.key === 'surface:prazos');
    expect((prazos?.content as ReactElement<{ recordProps: unknown }>).props.recordProps).toEqual({
      recordId: 'p1', record, collection: 'processos', screenSourceId: 'microteia:processo',
    });
  });

  it('a lista da tela-filha fica presa ao registro aberto', () => {
    const anexos = tabs().find((tab) => tab.key === 'child:anexos');
    expect((anexos?.content as ReactElement<Record<string, unknown>>).props).toEqual({
      screenKey: 'anexos', parentEntity: 'processos', parentFieldKey: 'processo', parentId: 'p1',
    });
  });

  it('registro novo não mostra aba nenhuma além de Dados', () => {
    expect(tabs(null)).toEqual([]);
  });
});
