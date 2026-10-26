// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScreenDefinition } from '../../../domain/entities';
import { createSchemaContext } from '../../../domain/schema/pathResolver';

/**
 * A janela de edição no Form Design. O que se exercita é a GRAVAÇÃO: o valor só vai quando a aba foi
 * tocada (reenviar o lido mudaria a forma e a regra cobraria a permissão de quem só mexeu no título),
 * e numa tela com `dataCollection` ele vai também ao documento da coleção, que é o que a regra lê.
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
  fields: [{ key: 'texto', label: 'Texto', type: 'text', required: true, order: 0, origin: 'design' }],
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
  state.permissions = new Set(['screens.manage', 'screens.edit-window']);
  state.definitions = [screen({ id: 'mensagens' })];
});

describe('ScreenBuilder — prazo para alteração', () => {
  it('a aba só aparece para quem tem `screens.edit-window`, como a regra', () => {
    const { result, rerender } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    expect(result.current.screenModalTabs.map((tab) => tab.key)).toContain('editWindow');

    state.permissions = new Set(['screens.manage']);
    rerender();
    expect(result.current.screenModalTabs.map((tab) => tab.key)).not.toContain('editWindow');
  });

  it('ligada, grava `{ minutes, delete }`', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    act(() => result.current.updateEditWindowForm({ enabled: true, minutes: '15', locksDelete: true }));
    await act(async () => { await result.current.handleSaveScreen(); });
    expect(savedFor('mensagens')?.editWindow).toEqual({ minutes: 15, delete: true });
  });

  it('desligada, grava `null` — e a janela sai do documento', async () => {
    state.definitions = [screen({ id: 'mensagens', editWindow: { minutes: 15 } })];
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    expect(result.current.screenForm.editWindow).toEqual({ enabled: true, minutes: '15', locksDelete: false });
    act(() => result.current.updateEditWindowForm({ enabled: false }));
    await act(async () => { await result.current.handleSaveScreen(); });
    expect(savedFor('mensagens')?.editWindow).toBeNull();
  });

  it('a aba não tocada reenvia a janela como está gravada', async () => {
    state.definitions = [screen({ id: 'mensagens', editWindow: { minutes: 15, delete: false } })];
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    act(() => result.current.updateScreenForm({ titleSingular: 'Recado' }));
    await act(async () => { await result.current.handleSaveScreen(); });
    expect(savedFor('mensagens')?.editWindow).toEqual({ minutes: 15, delete: false });
  });

  it('recusa minutos que não são inteiro positivo, sem gravar', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    for (const minutes of ['0', '1.5', '', '-3']) {
      act(() => result.current.updateEditWindowForm({ enabled: true, minutes }));
      await act(async () => { await result.current.handleSaveScreen(); });
    }
    expect(saveDefinition).not.toHaveBeenCalled();
    expect(result.current.screenModalTab).toBe('editWindow');
  });

  it('numa tela que descreve outra coleção, grava também no documento que a regra lê', async () => {
    state.definitions = [
      screen({ id: 'conversaMensagens', dataCollection: 'clientMessages', managed: true }),
      screen({ id: 'clientMessages', origin: 'builtin' }),
    ];
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('conversaMensagens'));
    expect(result.current.editWindowFromExtension).toBe(true);
    act(() => result.current.updateEditWindowForm({ enabled: true, minutes: '15' }));
    await act(async () => { await result.current.handleSaveScreen(); });
    expect(savedFor('conversaMensagens')?.editWindow).toEqual({ minutes: 15 });
    expect(savedFor('clientMessages')?.editWindow).toEqual({ minutes: 15 });
  });
});
