// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FieldDefinition, ScreenDefinition } from '../../domain/entities';

const storeState = {
  definitions: [] as ScreenDefinition[],
};

vi.mock('../../stores/useScreenDefinitions', () => ({
  useScreenDefinitions: () => ({
    definitions: storeState.definitions,
    getDefinition: (id: string) => storeState.definitions.find((d) => d.id === id),
  }),
}));

const { useEntityFormFields } = await import('./useEntityFormFields');

const definition = (overrides: Partial<ScreenDefinition>): ScreenDefinition =>
  ({
    id: 'persons',
    tenantId: 't1',
    origin: 'builtin',
    titleSingular: 'Pessoa',
    titlePlural: 'Pessoas',
    icon: 'user',
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
    const { result } = renderHook(() => useEntityFormFields('persons'));
    const name = result.current.fields.find((f) => f.key === 'name');
    expect(name?.label).toBe('Nome');
    expect(name?.origin).toBe('builtin');
    expect(result.current.addedFields).toHaveLength(0);
  });

  it('um campo materializado com origin builtin sobrescreve a declaração de código', () => {
    storeState.definitions = [definition({
      fields: [field({
        key: 'name',
        label: 'Nome completo',
        origin: 'builtin',
        logic: { onChange: 'object("apelido", name)' },
      })],
    })];

    const { result } = renderHook(() => useEntityFormFields('persons'));
    const name = result.current.fields.find((f) => f.key === 'name');

    expect(name?.label).toBe('Nome completo');
    expect(name?.logic?.onChange).toBe('object("apelido", name)');
    // Continua sendo do kernel: não entra na lista de adicionais nem pode ser excluído.
    expect(result.current.addedFields.some((f) => f.key === 'name')).toBe(false);
  });

  it('esconde do formulário o campo marcado como oculto', () => {
    storeState.definitions = [definition({
      fields: [field({ key: 'cpf', label: 'CPF', origin: 'builtin', hiddenInForm: true })],
    })];

    const { result } = renderHook(() => useEntityFormFields('persons'));
    expect(result.current.fields.some((f) => f.key === 'cpf')).toBe(false);
  });

  it('campo do tenant entra na mesma lista dos fixos, ordenado pelo `order` absoluto', () => {
    storeState.definitions = [definition({ fields: [field({ key: 'apelido', order: 99 })] })];

    const { result } = renderHook(() => useEntityFormFields('persons'));
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
        field({ key: 'name', label: 'Nome', origin: 'builtin', order: 2 }),
      ],
    })];

    const { result } = renderHook(() => useEntityFormFields('persons'));
    const keys = result.current.fields.map((f) => f.key);

    expect(keys.indexOf('apelido')).toBeLessThan(keys.indexOf('name'));
    expect(keys.indexOf('type')).toBeLessThan(keys.indexOf('apelido'));
  });

  it('as opções de todos os campos são indexadas pela própria coleção', () => {
    storeState.definitions = [definition({ fields: [field({ key: 'apelido' })] })];

    const { result } = renderHook(() => useEntityFormFields('persons'));
    const { resolveOptionsScreenKey, fields } = result.current;

    expect(resolveOptionsScreenKey(fields.find((f) => f.key === 'apelido')!)).toBe('persons');
    expect(resolveOptionsScreenKey(fields.find((f) => f.key === 'name')!)).toBe('persons');
  });
});
