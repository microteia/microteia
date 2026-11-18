// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScreenDefinition } from '../../../domain/entities';
import { createSchemaContext } from '../../../domain/schema/pathResolver';

/**
 * A seção "Ordem dos registros" da aba "Cartão". O que se exercita é a GRAVAÇÃO: a ordem só vai quando
 * foi tocada, uma chave que a tela não sustenta não é gravada, e tirar todas as chaves volta ao padrão.
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
    catalog: { byId: new Map(), list: [], resourceLabels: new Map(), diagnostics: [] },
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
    { key: 'vencimento', label: 'Vencimento', type: 'date', required: false, order: 1, origin: 'design' },
    { key: 'situacao', label: 'Situação', type: 'select', required: false, order: 2, origin: 'design' },
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
  state.permissions = new Set(['screens.manage']);
  state.definitions = [screen({ id: 'mensagens' })];
});

describe('ScreenBuilder — ordem dos registros', () => {
  it('oferece os campos da tela, e a aba lê a ordem gravada', () => {
    state.definitions = [screen({ id: 'mensagens', listOrder: [{ path: 'vencimento', dir: 'asc' }] })];
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    expect(result.current.listOrderFields.map((field) => field.key)).toEqual(['texto', 'vencimento', 'situacao']);
    expect(result.current.screenForm.listOrder).toEqual([{ path: 'vencimento', dir: 'asc' }]);
  });

  it('grava as chaves escolhidas, na ordem em que foram postas', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    act(() => result.current.updateListOrderForm([{ path: 'vencimento', dir: 'desc' }, { path: 'texto', dir: 'asc' }]));
    await act(async () => { await result.current.handleSaveScreen(); });
    expect(savedFor('mensagens')?.listOrder).toEqual([{ path: 'vencimento', dir: 'desc' }, { path: 'texto', dir: 'asc' }]);
  });

  it('uma chave que não ordena não é gravada — e a aba volta a ficar à vista', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    act(() => result.current.updateListOrderForm([{ path: 'situacao', dir: 'asc' }]));
    expect(result.current.listOrderIssues).toHaveLength(1);
    await act(async () => { await result.current.handleSaveScreen(); });
    expect(saveDefinition).not.toHaveBeenCalled();
    expect(result.current.screenModalTab).toBe('card');
    expect(notify).toHaveBeenCalledWith('core.records/list-order.panel.invalid', 'error');
  });

  it('tirar todas as chaves grava `null` — o cadastro mais recente primeiro', async () => {
    state.definitions = [screen({ id: 'mensagens', listOrder: [{ path: 'vencimento', dir: 'asc' }] })];
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    act(() => result.current.updateListOrderForm([]));
    await act(async () => { await result.current.handleSaveScreen(); });
    expect(savedFor('mensagens')?.listOrder).toBeNull();
  });

  it('a seção não tocada reenvia a ordem como está gravada, mesmo com uma chave que já não ordena', async () => {
    const stored = [{ path: 'apagado', dir: 'asc' as const }];
    state.definitions = [screen({ id: 'mensagens', listOrder: stored })];
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    act(() => result.current.updateScreenForm({ titleSingular: 'Recado' }));
    await act(async () => { await result.current.handleSaveScreen(); });
    expect(savedFor('mensagens')?.listOrder).toEqual(stored);
  });
});
