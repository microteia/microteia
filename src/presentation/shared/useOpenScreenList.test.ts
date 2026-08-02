// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { consumeNavigationIntent } from '../../infrastructure/navigation/navigationIntent';
import type { ScreenDefinition } from '../../domain/entities';

const openTab = vi.fn();
const state: { screens: ScreenDefinition[]; pageKeys: string[] } = { screens: [], pageKeys: [] };

vi.mock('../../stores/useScreenDefinitions', () => ({
  useScreenDefinitions: () => ({ dynamicScreens: state.screens }),
}));
vi.mock('../../stores/useWorkspace', () => ({
  useWorkspace: () => ({ openTab }),
}));
vi.mock('./useUiContributions', () => ({
  usePageContributions: () => state.pageKeys.map((key) => ({ metadata: { key } })),
}));

const { useOpenScreenList } = await import('./useOpenScreenList');

const screen = (overrides: Partial<ScreenDefinition>): ScreenDefinition => ({
  id: 'prazos',
  tenantId: 't1',
  origin: 'plugin',
  titleSingular: 'Prazo',
  titlePlural: 'Prazos',
  icon: 'time',
  dataCollection: 'deadlines',
  fields: [],
  titleFieldKey: 'type',
  hasNotes: false,
  hasDocuments: false,
  hasTags: false,
  listActions: [],
  viewActionIds: [],
  cardActionIds: [],
  sidebarOrder: 0,
  enabled: true,
  createdAt: new Date(),
  createdBy: 'u1',
  updatedAt: new Date(),
  ...overrides,
}) as ScreenDefinition;

const open = (collection: string, tokens?: { key: string; values: string[] }[]) => {
  const { result } = renderHook(() => useOpenScreenList());
  result.current(collection, tokens);
};

beforeEach(() => {
  openTab.mockClear();
  state.screens = [screen({})];
  state.pageKeys = [];
  consumeNavigationIntent('prazos');
});

/**
 * Quem manda navegar de fora (o painel, o cartão de um push) sabe O QUE quer ver, mas não conhece —
 * nem deve conhecer — a tela que apresenta aquela coleção: ela pode ser fixa hoje e de extensão
 * amanhã, com outra chave em cada escritório.
 */
describe('useOpenScreenList', () => {
  it('abre a página própria da extensão quando ela contribui uma', () => {
    state.pageKeys = ['prazos'];
    open('deadlines');
    expect(openTab).toHaveBeenCalledWith('prazos');
  });

  it('sem página própria, abre a listagem genérica da tela', () => {
    open('deadlines');
    expect(openTab).toHaveBeenCalledWith('dyn:prazos');
  });

  it('coleção que nenhuma tela descreve não abre nada — extensão desinstalada não vira aba morta', () => {
    open('produtos');
    expect(openTab).not.toHaveBeenCalled();
  });

  it('o filtro pedido é endereçado à tela resolvida, não à coleção', () => {
    open('deadlines', [{ key: 'status', values: ['Vencido'] }]);

    expect(consumeNavigationIntent('deadlines')).toBeUndefined();
    expect(consumeNavigationIntent('prazos')).toEqual([{ key: 'status', values: ['Vencido'] }]);
  });

  it('sem filtro, nada é deixado para a listagem — ela abre como o usuário a deixou', () => {
    open('deadlines');
    expect(consumeNavigationIntent('prazos')).toBeUndefined();
  });
});
