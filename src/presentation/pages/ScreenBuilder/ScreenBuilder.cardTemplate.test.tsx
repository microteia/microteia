// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScreenDefinition } from '../../../domain/entities';
import { createSchemaContext } from '../../../domain/schema/pathResolver';

/**
 * A aba "Cartão" do Form Design. O que se exercita é a GRAVAÇÃO: o valor só vai quando a aba foi
 * tocada, um desenho com defeito não é gravado, e desligar tudo devolve a tela ao cartão padrão.
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
  state.permissions = new Set(['screens.manage']);
  state.definitions = [screen({ id: 'mensagens' })];
});

describe('ScreenBuilder — cartão da listagem', () => {
  it('a aba existe na tela que já existe, e não na criação', () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    expect(result.current.screenModalTabs.map((tab) => tab.key)).toContain('card');
    expect(result.current.cardTemplateScreenKey).toBe('mensagens');
    expect(result.current.cardTemplateFields).toEqual([{ key: 'texto', type: 'text' }]);
  });

  it('só o arranjo: grava `{ layout }`', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    act(() => result.current.updateCardTemplateForm({ layout: 'list' }));
    await act(async () => { await result.current.handleSaveScreen(); });
    expect(savedFor('mensagens')?.cardTemplate).toEqual({ layout: 'list' });
  });

  it('com desenho: grava o JSON como objeto', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    act(() => result.current.updateCardTemplateForm({ custom: true, source: '{ "body": [{ "type": "field", "field": "texto" }] }' }));
    await act(async () => { await result.current.handleSaveScreen(); });
    expect(savedFor('mensagens')?.cardTemplate).toEqual({ body: [{ type: 'field', field: 'texto' }] });
  });

  it('desenho com defeito não é gravado — e a aba volta a ficar à vista', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    act(() => result.current.updateCardTemplateForm({ custom: true, source: '{ "body": [{ "type": "field", "field": "sumiu" }] }' }));
    await act(async () => { await result.current.handleSaveScreen(); });
    act(() => result.current.updateCardTemplateForm({ source: '{ "body": [' }));
    await act(async () => { await result.current.handleSaveScreen(); });
    expect(saveDefinition).not.toHaveBeenCalled();
    expect(result.current.screenModalTab).toBe('card');
    expect(notify).toHaveBeenCalledWith('core.records/card-template.panel.invalid', 'error');
  });

  it('voltar tudo ao padrão grava `null` — o cartão de sempre', async () => {
    state.definitions = [screen({ id: 'mensagens', cardTemplate: { layout: 'list', body: [{ type: 'title' }] } })];
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    expect(result.current.screenForm.cardTemplate).toMatchObject({ layout: 'list', custom: true });
    act(() => result.current.updateCardTemplateForm({ layout: 'grid', custom: false }));
    await act(async () => { await result.current.handleSaveScreen(); });
    expect(savedFor('mensagens')?.cardTemplate).toBeNull();
  });

  it('a aba não tocada reenvia o cartão como está gravado', async () => {
    const stored = { layout: 'list' as const, body: [{ type: 'title' as const }] };
    state.definitions = [screen({ id: 'mensagens', cardTemplate: stored })];
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditScreen('mensagens'));
    act(() => result.current.updateScreenForm({ titleSingular: 'Recado' }));
    await act(async () => { await result.current.handleSaveScreen(); });
    expect(savedFor('mensagens')?.cardTemplate).toEqual(stored);
  });
});
