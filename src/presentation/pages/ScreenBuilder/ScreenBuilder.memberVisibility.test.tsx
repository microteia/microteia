// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScreenDefinition } from '../../../domain/entities';
import { createSchemaContext } from '../../../domain/schema/pathResolver';

/**
 * A visibilidade por registro no Form Design. Como a janela de edição: o valor só vai quando a aba foi
 * tocada — a regra compara o VALOR e cobraria `screens.member-visibility` de quem só mexeu no título —,
 * e numa tela com `dataCollection` vai também ao documento da coleção, o que a regra lê.
 */

const saveDefinition = vi.fn(async (screenKey: string, input: Record<string, unknown>) => {
  void screenKey;
  void input;
  return {} as ScreenDefinition;
});
const notify = vi.fn();
const state = { definitions: [] as ScreenDefinition[], permissions: new Set<string>() };

vi.mock('styled-components', () => ({
  useTheme: () => ({ tagColors: [{ label: 'Azul', value: '#1e88e5' }] }),
}));
vi.mock('../../../stores/useAuthorization', () => ({
  useAuthorization: () => ({
    can: (permission: string) => state.permissions.has(permission),
    canAny: () => true,
    canAll: () => true,
    catalog: {
      byId: new Map(),
      list: [
        { id: 'mensagens.read-all', name: 'View all', requires: [], resource: 'mensagens', action: 'read-all', source: '', derived: true },
        { id: 'mensagens.supervise', name: 'Supervise', requires: [], resource: 'mensagens', action: 'supervise', source: 'x', derived: false },
      ],
      resourceLabels: new Map(),
      diagnostics: [],
    },
  }),
}));
vi.mock('../../../stores/useNotification', () => ({ useNotification: () => ({ notify }) }));
vi.mock('../../../stores/useActions', () => ({ useActions: () => ({ actions: [] }) }));
vi.mock('../../../stores/useInstalledExtensions', () => ({ useInstalledExtensions: () => ({ installed: [] }) }));
vi.mock('../../../stores/useLookups', () => ({
  useLookups: () => ({ availableLookups: [], declareLookup: vi.fn(), getOptions: () => [] }),
}));
vi.mock('../../../stores/useTags', () => ({
  useTags: () => ({ availableTagLists: [], declareTagList: vi.fn() }),
}));
vi.mock('../../shared/useSchemaContext', () => ({
  useSchemaContext: () => createSchemaContext(
    state.definitions.map((one) => ({ ...one, collection: one.dataCollection ?? undefined })),
  ),
}));
vi.mock('../../../infrastructure/di/useDI', () => ({ useDI: () => ({ externalLookupServices: [] }) }));
vi.mock('../../../stores/useKernel', () => ({
  useContributions: () => [],
  useKernel: () => ({ host: { implementations: { resolve: () => undefined } } }),
}));
vi.mock('../../../stores/useScreenDefinitions', () => ({
  useScreenDefinitions: () => ({
    definitions: state.definitions,
    dynamicScreens: [],
    isLoading: false,
    saveDefinition,
    deleteDefinition: vi.fn(),
  }),
  fieldOptionsKey: (screenKey: string, fieldKey: string) => `${screenKey}:${fieldKey}`,
}));

const { useScreenBuilderViewModel } = await import('./ScreenBuilder.viewmodel');

const screen = (over: Partial<ScreenDefinition> & Pick<ScreenDefinition, 'id'>): ScreenDefinition => ({
  tenantId: 't1',
  origin: 'design',
  titleSingular: 'Mensagem',
  titlePlural: 'Mensagens',
  icon: 'message',
  titleFieldKey: 'texto',
  fields: [
    { key: 'texto', label: 'Texto', type: 'text', required: true, order: 0, origin: 'design' },
    { key: 'emissor', label: 'Emissor', type: 'reference', refEntity: 'members', required: false, order: 1, origin: 'design' },
    { key: 'cliente', label: 'Cliente', type: 'reference', refEntity: 'clientes', required: false, order: 2, origin: 'design' },
  ],
  hasNotes: false,
  hasDocuments: false,
  hasTags: false,
  listActions: [],
  viewActionIds: [],
  cardActionIds: [],
  sidebarOrder: 10,
  enabled: true,
  createdAt: new Date(),
  createdBy: 'u1',
  updatedAt: new Date(),
  ...over,
});

const savedFor = (screenKey: string) =>
  saveDefinition.mock.calls.filter(([key]) => key === screenKey).at(-1)?.[1];

beforeEach(() => {
  saveDefinition.mockClear();
  notify.mockClear();
  state.permissions = new Set(['screens.manage', 'screens.member-visibility']);
  state.definitions = [screen({ id: 'mensagens' })];
});

describe('ScreenBuilder — visibilidade dos registros', () => {
  it('a aba só aparece para quem tem `screens.member-visibility`, como a regra', () => {
    const { result, rerender } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    expect(result.current.screenModalTabs.map((tab) => tab.key)).toContain('memberVisibility');

    state.permissions = new Set(['screens.manage']);
    rerender();
    expect(result.current.screenModalTabs.map((tab) => tab.key)).not.toContain('memberVisibility');
  });

  it('oferece só os campos de referência a membro, e a supervisão começa pela derivada', () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    expect(result.current.memberVisibilityPanel.fieldOptions.map((option) => option.value)).toEqual(['emissor']);
    expect(result.current.memberVisibilityPanel.bypassOptions.map((option) => option.value)).toEqual(['', 'mensagens.supervise']);
    expect(result.current.memberVisibilityPanel.bypassOptions[0].meta).toBe('mensagens.read-all');
  });

  it('ligada, grava a declaração — sem `bypassPermission` quando a supervisão é a derivada', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    act(() => result.current.updateMemberVisibilityForm({ enabled: true, userFields: ['emissor'] }));
    await act(async () => { await result.current.handleSaveScreen(); });
    expect(savedFor('mensagens')?.memberVisibility).toEqual({ userFields: ['emissor'] });
  });

  it('desligada, grava `null` — e a restrição sai do documento', async () => {
    state.definitions = [screen({ id: 'mensagens', memberVisibility: { userFields: ['emissor'], bypassPermission: 'mensagens.supervise' } })];
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    expect(result.current.screenForm.memberVisibility)
      .toEqual({ enabled: true, userFields: ['emissor'], bypassPermission: 'mensagens.supervise' });
    act(() => result.current.updateMemberVisibilityForm({ enabled: false }));
    await act(async () => { await result.current.handleSaveScreen(); });
    expect(savedFor('mensagens')?.memberVisibility).toBeNull();
  });

  it('a aba não tocada reenvia a declaração como está gravada', async () => {
    state.definitions = [screen({ id: 'mensagens', memberVisibility: { userFields: ['emissor'] } })];
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    act(() => result.current.updateScreenForm({ titleSingular: 'Recado' }));
    await act(async () => { await result.current.handleSaveScreen(); });
    expect(savedFor('mensagens')?.memberVisibility).toEqual({ userFields: ['emissor'] });
  });

  it('ligada sem campo, não grava e volta à aba', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    act(() => result.current.updateMemberVisibilityForm({ enabled: true, userFields: [] }));
    await act(async () => { await result.current.handleSaveScreen(); });
    expect(saveDefinition).not.toHaveBeenCalled();
    expect(result.current.screenModalTab).toBe('memberVisibility');
  });

  it('numa tela que descreve outra coleção, grava também no documento que a regra lê', async () => {
    state.definitions = [
      screen({ id: 'caixa', dataCollection: 'mensagens', managed: true }),
      screen({ id: 'mensagens', origin: 'builtin' }),
    ];
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('caixa'));
    act(() => result.current.updateMemberVisibilityForm({ enabled: true, userFields: ['emissor'] }));
    await act(async () => { await result.current.handleSaveScreen(); });
    expect(savedFor('caixa')?.memberVisibility).toEqual({ userFields: ['emissor'] });
    expect(savedFor('mensagens')?.memberVisibility).toEqual({ userFields: ['emissor'] });
  });
});
