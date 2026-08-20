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

const { useEntityFormFields, useResolvedFields } = await import('./useEntityFormFields');

const definition = (overrides: Partial<ScreenDefinition>): ScreenDefinition =>
  ({
    id: 'deadlines',
    tenantId: 't1',
    origin: 'builtin',
    titleSingular: 'Prazo',
    titlePlural: 'Prazos',
    icon: 'calendar',
    fields: [],
    titleFieldKey: 'type',
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
  /**
   * O rótulo sai do hook RESOLVIDO: o campo declarado em código traz uma referência, e é aqui que
   * ela vira texto. Sem catálogo — como neste teste — a resolução devolve a chave da referência, que
   * é o comportamento tolerante de `translate`: mostra a chave em vez de deixar a tela em branco.
   */
  it('sem tela do tenant, devolve os campos declarados em código', () => {
    const { result } = renderHook(() => useEntityFormFields('members'));
    const nome = result.current.fields.find((f) => f.key === 'name');
    expect(nome?.label).toBe('core.data/member.field.name');
    expect(nome?.origin).toBe('builtin');
    expect(result.current.addedFields).toHaveLength(0);
  });

  it('um campo materializado com origin builtin sobrescreve a declaração de código', () => {
    storeState.definitions = [definition({
      fields: [field({
        key: 'description',
        label: 'Resumo',
        origin: 'builtin',
        logic: { onChange: 'object("apelido", description)' },
      })],
    })];

    const { result } = renderHook(() => useEntityFormFields('deadlines'));
    const name = result.current.fields.find((f) => f.key === 'description');

    expect(name?.label).toBe('Resumo');
    expect(name?.logic?.onChange).toBe('object("apelido", description)');
    // Continua sendo do kernel: não entra na lista de adicionais nem pode ser excluído.
    expect(result.current.addedFields.some((f) => f.key === 'description')).toBe(false);
  });

  it('esconde do formulário o campo marcado como oculto', () => {
    storeState.definitions = [definition({
      fields: [field({ key: 'notes', label: 'Observações', origin: 'builtin', hiddenInForm: true })],
    })];

    const { result } = renderHook(() => useEntityFormFields('deadlines'));
    expect(result.current.fields.some((f) => f.key === 'notes')).toBe(false);
  });

  it('campo do tenant entra na mesma lista dos fixos, ordenado pelo `order` absoluto', () => {
    storeState.definitions = [definition({ fields: [field({ key: 'apelido', order: 99 })] })];

    const { result } = renderHook(() => useEntityFormFields('deadlines'));
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
        field({ key: 'dueDate', label: 'Vencimento', origin: 'builtin', order: 2 }),
      ],
    })];

    const { result } = renderHook(() => useEntityFormFields('deadlines'));
    const keys = result.current.fields.map((f) => f.key);

    expect(keys.indexOf('apelido')).toBeLessThan(keys.indexOf('dueDate'));
    expect(keys.indexOf('type')).toBeLessThan(keys.indexOf('apelido'));
  });

  it('cada campo carrega a própria lista de opções', () => {
    storeState.definitions = [definition({
      fields: [
        field({ key: 'especialidade', type: 'select', lookupCollection: 'prazos_especialidade' }),
        field({ key: 'tipo', type: 'select', lookupCollection: 'deadlineTypes' }),
      ],
    })];

    const { result } = renderHook(() => useEntityFormFields('deadlines'));
    const { fields } = result.current;

    // Não existe um índice de listas por TELA: a lista está no campo, e é isso que permite dois
    // campos — de telas diferentes, inclusive — compartilharem as mesmas opções.
    expect(fields.find((f) => f.key === 'especialidade')?.lookupCollection).toBe('prazos_especialidade');
    expect(fields.find((f) => f.key === 'tipo')?.lookupCollection).toBe('deadlineTypes');
  });
});

/**
 * A resolução de rótulo NÃO pode morar só no caminho de `useEntityFormFields`.
 *
 * Ela morava, e o efeito foi ver `@com.microteia.news/field.title` no formulário de uma extensão
 * recém-instalada: as quatro telas que leem `definition.fields` (formulário nativo, detalhe e
 * formulário de extensão, listagem) passavam pelo OUTRO ramo, o que não resolvia nada. `useResolvedFields`
 * é o ponto único, e estes casos são o que impede o ramo cru de voltar.
 */
describe('useResolvedFields', () => {
  it('resolve rótulo, placeholder, seção e opções de uma lista já montada', () => {
    const fields = [field({
      key: 'title',
      label: '@com.acme.docs/field.title',
      placeholder: '@com.acme.docs/field.title.placeholder',
      section: '@com.acme.docs/section.content',
      options: [{ key: 'a', label: '@com.acme.docs/option.a' }],
    })];

    const { result } = renderHook(() => useResolvedFields(fields));
    const [resolved] = result.current;

    // Sem catálogo montado, `resolveLabel` devolve a CHAVE da referência — nunca vazio, nunca o `@`.
    expect(resolved.label).toBe('com.acme.docs/field.title');
    expect(resolved.placeholder).toBe('com.acme.docs/field.title.placeholder');
    expect(resolved.section).toBe('com.acme.docs/section.content');
    expect(resolved.options?.[0].label).toBe('com.acme.docs/option.a');
  });

  /** O que o escritório digitou não é referência e passa intacto — é a metade que protege o dado dele. */
  it('não toca no texto que o escritório digitou', () => {
    const fields = [field({ key: 'apelido', label: 'Apelido do contrato', placeholder: 'Ex: locação' })];

    const { result } = renderHook(() => useResolvedFields(fields));

    expect(result.current[0].label).toBe('Apelido do contrato');
    expect(result.current[0].placeholder).toBe('Ex: locação');
  });

  /** Idempotência é o que permite aplicá-la DEPOIS do ramo, sobre uma lista que já veio resolvida. */
  it('aplicada duas vezes, dá o mesmo resultado', () => {
    const fields = [field({ key: 'title', label: '@com.acme.docs/field.title' })];

    const once = renderHook(() => useResolvedFields(fields)).result.current;
    const twice = renderHook(() => useResolvedFields(once)).result.current;

    expect(twice[0].label).toBe(once[0].label);
  });
});
