// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FieldDefinition, ScreenDefinition } from '../../../domain/entities';
import { createSchemaContext } from '../../../domain/schema/pathResolver';

/**
 * O açúcar `unique` no Form Design — a porta pela qual o escritório declara a chave sem escrever
 * lista nenhuma.
 *
 * O que se exercita aqui é a gravação, e não a caixinha: o valor tem de chegar ao documento da tela
 * (é dele que `resolveEntityKeys` desaçucara a chave) e tem de ser ZERADO quando o campo deixa de
 * poder carregá-la. A segunda metade é a que morde — um campo marcado como único que depois vira
 * derivado guardaria uma reserva sobre um valor que o registro não carrega.
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
  useAuthorization: () => ({ can: () => true, canAny: () => true, canAll: () => true }),
}));
vi.mock('../../../stores/useNotification', () => ({ useNotification: () => ({ notify }) }));
vi.mock('../../../stores/useActions', () => ({ useActions: () => ({ actions: [] }) }));
vi.mock('../../../stores/useLookups', () => ({
  useLookups: () => ({ availableLookups: [], declareLookup: vi.fn() }),
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

describe('ScreenBuilder — o campo único', () => {
  it('nasce desmarcado: uma tela sem chave aceita duplicata, e é o padrão de propósito', () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('produtos', 'sku'));
    expect(result.current.fieldForm.unique).toBe(false);
  });

  it('marcado, é gravado no campo — é de lá que a chave é desaçucarada', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('produtos', 'sku'));
    act(() => result.current.updateFieldForm({ unique: true }));
    await act(async () => { await result.current.handleSaveField(); });

    expect(savedFields().find((one) => one.key === 'sku')?.unique).toBe(true);
  });

  it('relido, volta marcado — o ajuste seguinte não o desliga sem ninguém pedir', () => {
    storeState.definition = produtos([
      field({ key: 'nome', label: 'Nome', required: true, order: 0 }),
      field({ key: 'sku', label: 'SKU', order: 1, unique: true }),
    ]);
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('produtos', 'sku'));
    expect(result.current.fieldForm.unique).toBe(true);
  });

  it('desmarcado, some do campo, e a chave deixa de existir com ele', async () => {
    storeState.definition = produtos([
      field({ key: 'nome', label: 'Nome', required: true, order: 0 }),
      field({ key: 'sku', label: 'SKU', order: 1, unique: true }),
    ]);
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('produtos', 'sku'));
    act(() => result.current.updateFieldForm({ unique: false }));
    await act(async () => { await result.current.handleSaveField(); });

    expect(savedFields().find((one) => one.key === 'sku')?.unique).toBe(false);
  });
});

describe('ScreenBuilder — o campo que NÃO pode ser chave', () => {
  it('o campo de arquivo não oferece a opção: o valor gravado é uma URL, diferente a cada upload', () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('produtos', 'sku'));
    act(() => result.current.updateFieldForm({ type: 'file' }));
    expect(result.current.fieldSupportsUnique).toBe(false);
  });

  it('o campo DERIVADO não oferece a opção — o valor dele nunca fica gravado', () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('produtos', 'sku'));
    act(() => result.current.updateFieldForm({ logicDerive: 'today()' }));
    expect(result.current.fieldSupportsUnique).toBe(false);
  });

  it('o campo AGREGADO não oferece a opção — ele é reescrito a cada gravação de filho', () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('produtos', 'sku'));
    act(() => result.current.updateFieldForm({ aggregationFrom: 'itens', aggregationVia: 'produtoId' }));
    expect(result.current.fieldSupportsUnique).toBe(false);
  });

  /**
   * Zerar no DADO, e não só esconder na tela: o campo pode ter sido marcado como único antes de
   * virar derivado, e uma reserva sobre valor que o registro não carrega fica órfã em silêncio.
   */
  it('marcar único e DEPOIS torná-lo derivado grava o campo sem a chave', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('produtos', 'sku'));
    act(() => result.current.updateFieldForm({ unique: true }));
    act(() => result.current.updateFieldForm({ logicDerive: 'today()' }));
    await act(async () => { await result.current.handleSaveField(); });

    expect(savedFields().find((one) => one.key === 'sku')?.unique).toBe(false);
  });
});
