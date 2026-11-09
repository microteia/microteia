// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FieldDefinition, ScreenDefinition } from '../../../domain/entities';
import { createSchemaContext } from '../../../domain/schema/pathResolver';

/**
 * A numeração (`autoValue.sequence`) no Form Design — a porta pela qual o escritório liga o número
 * sequencial sem extensão nenhuma.
 *
 * O que se exercita é a gravação: a declaração tem de chegar ao documento da tela com a forma que a
 * gravação do registro lê; a forma que repetiria o número é recusada antes de gravar; e a numeração JÁ
 * gravada não muda mais — mudar o formato ou a contagem depois de números emitidos poderia emitir de
 * novo um número que existe.
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
    field({ key: 'sku', label: 'SKU', order: 1 }),
  ]);
});

describe('ScreenBuilder — a numeração do campo', () => {
  it('nasce desligada, e um campo novo sem ela não ganha `autoValue`', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openCreateField('produtos'));
    expect(result.current.fieldForm.sequence.enabled).toBe(false);
    act(() => result.current.updateFieldForm({ label: 'Protocolo', fieldKey: 'protocolo' }));
    await act(async () => { await result.current.handleSaveField(); });
    expect(savedFields().find((one) => one.key === 'protocolo')?.autoValue).toBeUndefined();
  });

  it('ligada num campo novo, grava a declaração que a gravação do registro lê', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openCreateField('produtos'));
    act(() => result.current.updateFieldForm({ label: 'Protocolo', fieldKey: 'protocolo' }));
    act(() => result.current.updateFieldSequence({ enabled: true }));
    expect(result.current.fieldSupportsSequence).toBe(true);
    expect(result.current.sequencePanel.preview).toMatch(/^\d{4}\/000001$/);
    await act(async () => { await result.current.handleSaveField(); });
    expect(savedFields().find((one) => one.key === 'protocolo')?.autoValue)
      .toEqual({ pattern: 'YYYY/000000', sequence: { scope: 'tenant', resetBy: 'year' } });
  });

  it('o formato que repetiria o número é recusado antes de gravar, na aba dele', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('produtos', 'sku'));
    act(() => result.current.updateFieldSequence({ enabled: true, pattern: '000000', resetBy: 'year' }));
    await act(async () => { await result.current.handleSaveField(); });
    expect(saveDefinition).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith('core.records/field.sequence.error.pattern-year', 'error');
    expect(result.current.fieldModalTab).toBe('sequence');
  });

  it('a numeração já gravada fica travada: o que se mude na seção não chega ao documento', async () => {
    const autoValue = { pattern: 'YYYY/000000', sequence: { resetBy: 'year' as const } };
    storeState.definition = produtos([
      field({ key: 'nome', label: 'Nome', required: true, order: 0 }),
      field({ key: 'protocolo', label: 'Protocolo', order: 1, autoValue }),
    ]);
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('produtos', 'protocolo'));
    expect(result.current.sequencePanel.locked).toBe(true);
    expect(result.current.fieldForm.sequence).toMatchObject({ enabled: true, pattern: 'YYYY/000000', resetBy: 'year' });
    act(() => result.current.updateFieldSequence({ resetBy: 'never', pattern: '000' }));
    act(() => result.current.updateFieldForm({ label: 'Nº do protocolo' }));
    await act(async () => { await result.current.handleSaveField(); });
    const saved = savedFields().find((one) => one.key === 'protocolo');
    expect(saved?.label).toBe('Nº do protocolo');
    expect(saved?.autoValue).toEqual(autoValue);
  });

  it('o código sorteado que uma extensão declarou atravessa a edição intacto', async () => {
    storeState.definition = produtos([
      field({ key: 'nome', label: 'Nome', required: true, order: 0 }),
      field({ key: 'codigo', label: 'Código', order: 1, origin: 'plugin', autoValue: { pattern: 'AA0000' } }),
    ]);
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('produtos', 'codigo'));
    expect(result.current.sequencePanel.locked).toBe(false);
    expect(result.current.fieldForm.sequence.enabled).toBe(false);
    await act(async () => { await result.current.handleSaveField(); });
    expect(savedFields().find((one) => one.key === 'codigo')?.autoValue).toEqual({ pattern: 'AA0000' });
  });

  it('contar por pai só aparece na tela que tem pai', () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('produtos', 'sku'));
    expect(result.current.sequencePanel.hasParent).toBe(false);

    storeState.definition = { ...produtos([field({ key: 'nome', order: 0 }), field({ key: 'pedidoId', order: 1 })]), parentFieldKey: 'pedidoId' };
    const child = renderHook(() => useScreenBuilderViewModel());
    act(() => child.result.current.openEditField('produtos', 'nome'));
    expect(child.result.current.sequencePanel.hasParent).toBe(true);
  });

  it('campo calculado não é numerado: as duas origens disputariam o valor', () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('produtos', 'sku'));
    act(() => result.current.updateFieldForm({ logicCompute: 'nome' }));
    expect(result.current.fieldSupportsSequence).toBe(false);
  });
});
