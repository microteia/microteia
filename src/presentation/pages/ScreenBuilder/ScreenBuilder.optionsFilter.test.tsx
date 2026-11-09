// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FieldDefinition, ScreenDefinition } from '../../../domain/entities';
import { createSchemaContext } from '../../../domain/schema/pathResolver';

/**
 * O filtro de opções (`optionsFilter`) no Form Design. O que se exercita é o caminho de ida e volta:
 * a condição editada chega ao documento da tela na forma que o formulário do registro lê, a já gravada
 * volta ao editor, e a condição pela metade é recusada na aba dela em vez de sumir calada.
 */

const saveDefinition = vi.fn(
  async (screenKey: string, input: { fields: FieldDefinition[] }) => {
    void screenKey;
    void input;
    return {} as ScreenDefinition;
  },
);
const notify = vi.fn();
const storeState = { definition: undefined as ScreenDefinition | undefined };

vi.mock('styled-components', () => ({
  useTheme: () => ({ tagColors: [{ label: 'Azul', value: '#1e88e5' }] }),
}));
vi.mock('../../../stores/useAuthorization', () => ({
  useAuthorization: () => ({
    can: () => true,
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
    storeState.definition
      ? [{ ...storeState.definition, collection: storeState.definition.dataCollection ?? undefined }]
      : [],
  ),
}));
vi.mock('../../../infrastructure/di/useDI', () => ({
  useDI: () => ({ externalLookupServices: [] }),
}));
vi.mock('../../../stores/useKernel', () => ({
  useContributions: () => [],
  useKernel: () => ({ host: { implementations: { resolve: () => undefined } } }),
}));
vi.mock('../../../stores/useScreenDefinitions', () => ({
  useScreenDefinitions: () => ({
    definitions: storeState.definition ? [storeState.definition] : [],
    dynamicScreens: [],
    isLoading: false,
    saveDefinition,
    deleteDefinition: vi.fn(),
  }),
  fieldOptionsKey: (screenKey: string, fieldKey: string) => `${screenKey}:${fieldKey}`,
}));

const { useScreenBuilderViewModel } = await import('./ScreenBuilder.viewmodel');

const field = (over: Partial<FieldDefinition> & Pick<FieldDefinition, 'key'>): FieldDefinition => ({
  label: over.key,
  type: 'text',
  required: false,
  order: 0,
  origin: 'design',
  ...over,
});

const produtos = (fields: FieldDefinition[]): ScreenDefinition => ({
  id: 'produtos',
  tenantId: 't1',
  origin: 'design',
  titleSingular: 'Produto',
  titlePlural: 'Produtos',
  icon: 'apps',
  titleFieldKey: 'nome',
  fields,
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
});

const savedFields = (): FieldDefinition[] => saveDefinition.mock.calls.at(-1)?.[1].fields ?? [];

beforeEach(() => {
  saveDefinition.mockClear();
  notify.mockClear();
  storeState.definition = produtos([
    field({ key: 'nome', label: 'Nome', required: true, order: 0 }),
    field({ key: 'categoria', label: 'Categoria', type: 'select', options: [{ key: 'a', label: 'A' }], order: 1 }),
    field({ key: 'tipo', label: 'Tipo', type: 'select', options: [{ key: 'br-x', label: 'BR X' }], order: 2 }),
  ]);
});

describe('ScreenBuilder — o filtro de opções do campo', () => {
  it('a aba de opções existe para lista e referência, e não para texto', () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('produtos', 'tipo'));
    expect(result.current.fieldModalTabs.map((tab) => tab.key)).toContain('options');
    act(() => result.current.openEditField('produtos', 'nome'));
    expect(result.current.fieldModalTabs.map((tab) => tab.key)).not.toContain('options');
  });

  it('numa lista, o caminho é a chave ou o rótulo da opção', () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('produtos', 'tipo'));
    expect(result.current.optionsFilterPathOptions.map((option) => option.value)).toEqual(['key', 'label']);
    expect(result.current.optionsFilterSourceOptions.map((option) => option.value)).toEqual(['nome', 'categoria']);
  });

  it('a condição chega ao documento na forma que o formulário lê', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('produtos', 'tipo'));
    act(() => result.current.addOptionsFilterRow());
    act(() => result.current.updateOptionsFilterRow(0, { path: 'key', op: 'startsWith', source: 'categoria' }));
    await act(async () => { await result.current.handleSaveField(); });
    expect(savedFields().find((one) => one.key === 'tipo')?.optionsFilter)
      .toEqual({ where: [{ path: 'key', op: 'startsWith', value: { field: 'categoria' } }] });
  });

  it('o valor fixo do "está entre" é uma lista', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('produtos', 'tipo'));
    act(() => result.current.addOptionsFilterRow());
    act(() => result.current.updateOptionsFilterRow(0, { path: 'key', op: 'in', sourceKind: 'literal' }));
    act(() => result.current.updateOptionsFilterRow(0, { source: 'br-x, br-y' }));
    await act(async () => { await result.current.handleSaveField(); });
    expect(savedFields().find((one) => one.key === 'tipo')?.optionsFilter)
      .toEqual({ where: [{ path: 'key', op: 'in', value: { literal: ['br-x', 'br-y'] } }] });
  });

  it('a condição gravada volta ao editor', () => {
    storeState.definition = produtos([
      field({ key: 'nome', label: 'Nome', required: true, order: 0 }),
      field({
        key: 'tipo',
        type: 'select',
        options: [{ key: 'br-x', label: 'BR X' }],
        order: 1,
        optionsFilter: { where: [{ path: 'label', op: 'contains', value: { literal: 'BR' } }] },
      }),
    ]);
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('produtos', 'tipo'));
    expect(result.current.fieldForm.optionsFilter)
      .toEqual([{ path: 'label', op: 'contains', sourceKind: 'literal', source: 'BR' }]);
  });

  it('a condição pela metade é recusada na aba de opções', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('produtos', 'tipo'));
    act(() => result.current.addOptionsFilterRow());
    act(() => result.current.updateOptionsFilterRow(0, { path: 'key' }));
    await act(async () => { await result.current.handleSaveField(); });
    expect(saveDefinition).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith('core.records/field.error.options-filter-incomplete', 'error');
    expect(result.current.fieldModalTab).toBe('options');
  });

  it('a linha deixada em branco não vira condição', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('produtos', 'tipo'));
    act(() => result.current.addOptionsFilterRow());
    await act(async () => { await result.current.handleSaveField(); });
    expect(savedFields().find((one) => one.key === 'tipo')?.optionsFilter).toBeNull();
  });
});
