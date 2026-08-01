// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FieldDefinition, ScreenDefinition } from '../../domain/entities';

const storeState = {
  definitions: [] as ScreenDefinition[],
};

vi.mock('../../stores/useLookups', () => ({
  useLookups: () => ({ availableLookups: [] }),
}));

vi.mock('../../stores/useTags', () => ({
  useTags: () => ({ availableTagLists: [] }),
}));

vi.mock('../../stores/useScreenDefinitions', () => ({
  useScreenDefinitions: () => ({
    definitions: storeState.definitions,
    getDefinition: (id: string) => storeState.definitions.find((d) => d.id === id),
  }),
}));

const { useEntityFormFields } = await import('./useEntityFormFields');

const definition = (overrides: Partial<ScreenDefinition>): ScreenDefinition =>
  ({
    id: 'financials',
    tenantId: 't1',
    origin: 'builtin',
    titleSingular: 'Financeiro',
    titlePlural: 'Financeiro',
    icon: 'moneyDollar',
    fields: [],
    titleFieldKey: 'category',
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

const field = (overrides: Partial<FieldDefinition> & Pick<FieldDefinition, 'key'>): FieldDefinition => ({
  label: overrides.key,
  type: 'text',
  required: false,
  order: 0,
  origin: 'design',
  ...overrides,
});

beforeEach(() => {
  storeState.definitions = [];
});

describe('useEntityFormFields', () => {
  it('sem tela do tenant, devolve os campos declarados em código', () => {
    const { result } = renderHook(() => useEntityFormFields('financials'));
    const name = result.current.fields.find((f) => f.key === 'category');
    expect(name?.label).toBe('Categoria');
    expect(name?.origin).toBe('builtin');
    expect(result.current.addedFields).toHaveLength(0);
  });

  it('um campo materializado com origin builtin sobrescreve a declaração de código', () => {
    storeState.definitions = [definition({
      fields: [field({
        key: 'invoiceNumber',
        label: 'Número da NF-e',
        origin: 'builtin',
        logic: { onChange: 'object("apelido", invoiceNumber)' },
      })],
    })];

    const { result } = renderHook(() => useEntityFormFields('financials'));
    const name = result.current.fields.find((f) => f.key === 'invoiceNumber');

    expect(name?.label).toBe('Número da NF-e');
    expect(name?.logic?.onChange).toBe('object("apelido", invoiceNumber)');
    // Continua sendo do kernel: não entra na lista de adicionais nem pode ser excluído.
    expect(result.current.addedFields.some((f) => f.key === 'invoiceNumber')).toBe(false);
  });

  it('esconde do formulário o campo marcado como oculto', () => {
    storeState.definitions = [definition({
      fields: [field({ key: 'notes', label: 'Observações', origin: 'builtin', hiddenInForm: true })],
    })];

    const { result } = renderHook(() => useEntityFormFields('financials'));
    expect(result.current.fields.some((f) => f.key === 'notes')).toBe(false);
  });

  it('campo do tenant entra na mesma lista dos fixos, ordenado pelo `order` absoluto', () => {
    storeState.definitions = [definition({ fields: [field({ key: 'apelido', order: 99 })] })];

    const { result } = renderHook(() => useEntityFormFields('financials'));
    const keys = result.current.fields.map((f) => f.key);

    expect(keys).toContain('apelido');
    expect(keys.indexOf('apelido')).toBe(keys.length - 1);
    expect(result.current.addedFields).toHaveLength(1);
  });

  it('o campo do tenant pode ficar ENTRE os fixos — é um espaço de ordenação só', () => {
    storeState.definitions = [definition({
      fields: [
        field({ key: 'type', label: 'Tipo', origin: 'builtin', order: 0 }),
        field({ key: 'apelido', order: 1 }),
        field({ key: 'amount', label: 'Valor', origin: 'builtin', order: 2 }),
      ],
    })];

    const { result } = renderHook(() => useEntityFormFields('financials'));
    const keys = result.current.fields.map((f) => f.key);

    expect(keys.indexOf('apelido')).toBeLessThan(keys.indexOf('amount'));
    expect(keys.indexOf('type')).toBeLessThan(keys.indexOf('apelido'));
  });

  it('cada campo carrega a própria lista de opções, seja do kernel ou do tenant', () => {
    storeState.definitions = [definition({
      fields: [field({ key: 'especialidade', type: 'select', lookupCollection: 'financials_especialidade' })],
    })];

    const { result } = renderHook(() => useEntityFormFields('financials'));
    const { fields } = result.current;

    // O campo do tenant aponta para a lista declarada; o do kernel, para a do registro. Não existe
    // mais um índice por tela: a lista está no campo, e é isso que permite compartilhá-la.
    expect(fields.find((f) => f.key === 'especialidade')?.lookupCollection).toBe('financials_especialidade');
    expect(fields.find((f) => f.key === 'category')?.lookupCollection).toBe('financialCategories');
  });
});
