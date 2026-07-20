// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FieldDefinition, ScreenDefinition } from '../../domain/entities';

const storeState = {
  definition: undefined as ScreenDefinition | undefined,
  customFields: [] as FieldDefinition[],
};

vi.mock('../../stores/useScreenDefinitions', () => ({
  useScreenDefinitions: () => ({
    getDefinition: () => storeState.definition,
    getCustomFieldsFor: () => storeState.customFields,
  }),
}));

const { useEntityFormFields } = await import('./useEntityFormFields');

const definition = (overrides: Partial<ScreenDefinition>): ScreenDefinition =>
  ({
    id: 'persons',
    tenantId: 't1',
    builtin: true,
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

const customField = (key: string, order: number): FieldDefinition => ({
  key,
  label: key,
  type: 'text',
  required: false,
  order,
});

beforeEach(() => {
  storeState.definition = undefined;
  storeState.customFields = [];
});

describe('useEntityFormFields', () => {
  it('sem ajustes, devolve os campos do código', () => {
    const { result } = renderHook(() => useEntityFormFields('persons'));
    const name = result.current.fields.find((f) => f.key === 'name');
    expect(name?.label).toBe('Nome');
  });

  it('aplica o ajuste do tenant sobre o campo do sistema', () => {
    storeState.definition = definition({
      nativeFieldOverrides: {
        name: { label: 'Nome completo', logic: { onChange: 'object("apelido", name)' } },
      },
    });

    const { result } = renderHook(() => useEntityFormFields('persons'));
    const name = result.current.fields.find((f) => f.key === 'name');

    expect(name?.label).toBe('Nome completo');
    expect(name?.logic?.onChange).toBe('object("apelido", name)');
  });

  it('esconde do formulário o campo marcado como oculto', () => {
    storeState.definition = definition({ nativeFieldOverrides: { cpf: { hiddenInForm: true } } });

    const { result } = renderHook(() => useEntityFormFields('persons'));
    expect(result.current.fields.some((f) => f.key === 'cpf')).toBe(false);
  });

  it('junta fixos e adicionais numa lista só, com os adicionais ao final', () => {
    storeState.customFields = [customField('apelido', 0)];

    const { result } = renderHook(() => useEntityFormFields('persons'));
    const keys = result.current.fields.map((f) => f.key);

    expect(keys).toContain('apelido');
    expect(keys.indexOf('apelido')).toBe(keys.length - 1);
    expect(result.current.customFields).toHaveLength(1);
  });

  it('com a ordem unificada, o adicional pode ficar entre os fixos', () => {
    storeState.definition = definition({
      fieldOrderUnified: true,
      nativeFieldOverrides: { type: { order: 0 }, name: { order: 2 } },
    });
    storeState.customFields = [customField('apelido', 1)];

    const { result } = renderHook(() => useEntityFormFields('persons'));
    const keys = result.current.fields.map((f) => f.key);

    expect(keys.indexOf('apelido')).toBeLessThan(keys.indexOf('name'));
    expect(keys.indexOf('type')).toBeLessThan(keys.indexOf('apelido'));
  });

  it('resolve a tela das opções por origem do campo', () => {
    storeState.customFields = [customField('apelido', 0)];

    const { result } = renderHook(() => useEntityFormFields('persons'));
    const { resolveOptionsScreenKey, fields } = result.current;

    expect(resolveOptionsScreenKey(fields.find((f) => f.key === 'apelido')!)).toBe('persons');
    expect(resolveOptionsScreenKey(fields.find((f) => f.key === 'name')!)).toBe('persons-native');
  });
});
