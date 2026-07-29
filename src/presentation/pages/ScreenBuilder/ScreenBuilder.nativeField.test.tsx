// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FieldDefinition, ScreenDefinition } from '../../../domain/entities';
import { createSchemaContext } from '../../../domain/schema/pathResolver';

/**
 * O campo do kernel (`origin: 'builtin'`) segue o MESMO caminho de gravação dos demais: a primeira
 * edição materializa a declaração inteira em `fields[]`, e a partir daí o documento é a verdade.
 * O que ele não aceita é ser excluído.
 *
 * Também é a regressão da ordem das validações em `handleSaveField`: um campo fixo do tipo seleção
 * (opções vindas de um lookup, sem `staticOptions`) não pode ser recusado com "Adicione ao menos
 * uma opção".
 */

const saveDefinition = vi.fn(async () => ({}) as ScreenDefinition);
const notify = vi.fn();
const storeState = { definition: undefined as ScreenDefinition | undefined };

vi.mock('styled-components', () => ({
  useTheme: () => ({ tagColors: [{ label: 'Azul', value: '#1e88e5' }] }),
}));
vi.mock('../../../stores/useTenant', () => ({ useTenant: () => ({ tenantRole: 'admin' }) }));
vi.mock('../../../stores/useNotification', () => ({ useNotification: () => ({ notify }) }));
vi.mock('../../../stores/useActions', () => ({ useActions: () => ({ actions: [] }) }));
vi.mock('../../shared/useSchemaContext', () => ({
  useSchemaContext: () => createSchemaContext(storeState.definition ? [storeState.definition] : []),
}));
vi.mock('../../../infrastructure/di/useDI', () => ({
  useDI: () => ({ externalLookupServices: [] }),
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

const personsDefinition = (overrides: Partial<ScreenDefinition> = {}): ScreenDefinition =>
  ({
    id: 'persons',
    tenantId: 't1',
    origin: 'builtin',
    titleSingular: 'Pessoa',
    titlePlural: 'Pessoas',
    icon: 'user',
    fields: [],
    titleFieldKey: '',
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

const savedFields = (call = 0): FieldDefinition[] => {
  const [, payload] = saveDefinition.mock.calls[call] as unknown as [string, ScreenDefinition];
  return payload.fields;
};

const savedField = (key: string, call = 0): FieldDefinition | undefined =>
  savedFields(call).find((field) => field.key === key);

beforeEach(() => {
  saveDefinition.mockClear();
  notify.mockClear();
  storeState.definition = personsDefinition();
});

describe('ScreenBuilder — ajuste de campo do sistema', () => {
  it('campo do sistema salva mesmo quando o estado tripa uma validação de opções', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());

    act(() => result.current.openEditField('persons', 'gender'));
    expect(result.current.fieldModalIsNative).toBe(true);

    // Campo fixo do tipo seleção cujas opções vêm de um lookup — sem `staticOptions` e sem permitir
    // criação pelo usuário. Nenhum campo nativo está nessa combinação HOJE, mas um assim não pode
    // ficar impossível de ajustar quando for declarado no registry.
    act(() => result.current.updateFieldForm({
      label: 'Gênero',
      type: 'select',
      staticOptions: [],
      optionsAllowUserAdd: false,
    }));
    await act(async () => { await result.current.handleSaveField(); });

    expect(notify).not.toHaveBeenCalledWith(
      expect.stringContaining('Adicione ao menos uma opção'),
      'error',
    );
    expect(saveDefinition).toHaveBeenCalledTimes(1);

    const [screenKey] = saveDefinition.mock.calls[0] as unknown as [string, ScreenDefinition];
    expect(screenKey).toBe('persons');
    expect(savedField('gender')).toMatchObject({ label: 'Gênero', origin: 'builtin' });
  });

  it('materializa a declaração INTEIRA do campo do kernel na primeira edição', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());

    act(() => result.current.openEditField('persons', 'name'));
    act(() => result.current.updateFieldForm({
      logicOnChange: 'object("apelido", name)',
      logicHiddenWhen: "type == 'PJ'",
    }));
    await act(async () => { await result.current.handleSaveField(); });

    expect(savedField('name')).toMatchObject({
      key: 'name',
      label: 'Nome',
      origin: 'builtin',
      required: true,
      logic: { hiddenWhen: "type == 'PJ'", onChange: 'object("apelido", name)' },
    });
  });

  it('grava regra e validação do campo do kernel — o backend lê a mesma lista', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());

    act(() => result.current.openEditField('persons', 'email'));
    act(() => result.current.updateFieldForm({ logicValidate: "if(isEmpty(value), 'Obrigatório', null)" }));
    await act(async () => { await result.current.handleSaveField(); });

    expect(savedField('email')?.logic?.validate).toBe("if(isEmpty(value), 'Obrigatório', null)");
  });

  it('preserva os ajustes dos outros campos ao salvar um', async () => {
    storeState.definition = personsDefinition({
      fields: [{ key: 'cpf', label: 'Documento', type: 'masked', required: false, order: 2, origin: 'builtin' }],
    });

    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('persons', 'name'));
    act(() => result.current.updateFieldForm({ label: 'Nome completo' }));
    await act(async () => { await result.current.handleSaveField(); });

    expect(savedField('cpf')?.label).toBe('Documento');
    expect(savedField('name')?.label).toBe('Nome completo');
  });

  it('restaurar padrão remove só a entrada daquele campo', async () => {
    storeState.definition = personsDefinition({
      fields: [
        { key: 'name', label: 'X', type: 'text', required: true, order: 1, origin: 'builtin' },
        { key: 'cpf', label: 'Documento', type: 'masked', required: false, order: 2, origin: 'builtin' },
      ],
    });

    const { result } = renderHook(() => useScreenBuilderViewModel());
    await act(async () => { await result.current.restoreNativeField('persons', 'name'); });

    expect(savedFields().map((f) => f.key)).toEqual(['cpf']);
  });

  it('reordenar grava posições absolutas na mesma lista', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    await act(async () => { await result.current.moveField('persons', 'name', 1); });

    const moved = savedField('name');
    expect(moved?.origin).toBe('builtin');
    expect(typeof moved?.order).toBe('number');
  });

  it('distingue campo do kernel de campo do usuário pela origem', () => {
    storeState.definition = personsDefinition({
      fields: [{ key: 'apelido', label: 'Apelido', type: 'text', required: false, order: 0, origin: 'design' }],
    });

    const { result } = renderHook(() => useScreenBuilderViewModel());
    expect(result.current.isNativeField('persons', 'name')).toBe(true);
    expect(result.current.isNativeField('persons', 'apelido')).toBe(false);
  });
});
