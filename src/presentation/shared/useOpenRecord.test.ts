// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ScreenDefinition } from '../../domain/entities';

const openTab = vi.fn();
const state: { screens: ScreenDefinition[] } = { screens: [] };

vi.mock('../../stores/useScreenDefinitions', () => ({
  useScreenDefinitions: () => ({ dynamicScreens: state.screens }),
}));
vi.mock('../../stores/useWorkspace', () => ({
  useWorkspace: () => ({ openTab }),
}));

const { useOpenRecord } = await import('./useOpenRecord');

const screen = (overrides: Partial<ScreenDefinition>): ScreenDefinition => ({
  id: 'pessoas',
  tenantId: 't1',
  origin: 'plugin',
  titleSingular: 'Pessoa',
  titlePlural: 'Pessoas',
  icon: 'team',
  fields: [],
  titleFieldKey: 'name',
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

const open = (collection: string, recordId: string) => {
  const { result } = renderHook(() => useOpenRecord());
  result.current(collection, recordId);
};

beforeEach(() => {
  openTab.mockClear();
  state.screens = [];
});

/**
 * Abrir um registro de FORA (auditoria, menção, card de outra tela) é resolver a coleção na tela que
 * a apresenta HOJE. Guardar a chave de aba envelhece: `view-person:` deixou de existir no dia em que
 * Pessoa saiu do kernel, e o botão da auditoria passou a abrir tela vazia.
 */
describe('useOpenRecord', () => {
  it('a tela sem editor próprio abre pela aba genérica', () => {
    state.screens = [screen({ id: 'pessoas', dataCollection: 'persons' })];
    open('persons', 'p1');
    expect(openTab).toHaveBeenCalledWith('view-dyn:pessoas:p1');
  });

  it('a tela que declara editor próprio abre nele', () => {
    state.screens = [screen({ id: 'processos', dataCollection: 'cases', recordTabPrefix: 'processo-edit:' })];
    open('cases', 'c1');
    expect(openTab).toHaveBeenCalledWith('processo-edit:c1');
  });

  it('prefixo em branco não conta como declaração', () => {
    state.screens = [screen({ id: 'processos', dataCollection: 'cases', recordTabPrefix: '  ' })];
    open('cases', 'c1');
    expect(openTab).toHaveBeenCalledWith('view-dyn:processos:c1');
  });

  /** Entidade ainda do kernel: vale a chave fixa de sempre. */
  it('coleção fixa abre pela aba do kernel', () => {
    open('financials', 'f1');
    expect(openTab).toHaveBeenCalledWith('view-financial:f1');
  });

  /** Extensão desinstalada: nada abre, em vez de uma aba morta. */
  it('coleção sem tela e sem aba fixa não abre nada', () => {
    open('produtos', 'x1');
    expect(openTab).not.toHaveBeenCalled();
  });
});
