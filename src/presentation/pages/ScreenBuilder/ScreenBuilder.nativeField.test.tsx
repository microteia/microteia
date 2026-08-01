// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FieldDefinition, ScreenDefinition } from '../../../domain/entities';
import { createSchemaContext } from '../../../domain/schema/pathResolver';
import { ENTITY_REGISTRY_LIST } from '../../../domain/schema/entityRegistry';

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
vi.mock('../../../stores/useLookups', () => ({
  useLookups: () => ({ availableLookups: [], declareLookup: vi.fn() }),
}));
vi.mock('../../../stores/useTags', () => ({
  useTags: () => ({ availableTagLists: [], declareTagList: vi.fn() }),
}));
// Mesma tradução do `useSchemaContext` real: a tela entra pela COLEÇÃO que descreve.
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
// Sem extensão instalada, o catálogo de máscaras/formatações é só o do núcleo — o que a autoria
// enxerga aqui é exatamente o mesmo conjunto de antes.
// Sem contribuições de ação de registro: a aba "Listagem" fica sem caixas, e é o que este teste
// exercita — o ajuste de CAMPO não depende delas.
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

const builtinDefinition = (overrides: Partial<ScreenDefinition> = {}): ScreenDefinition =>
  ({
    id: 'deadlines',
    tenantId: 't1',
    origin: 'builtin',
    titleSingular: 'Prazo',
    titlePlural: 'Prazos',
    icon: 'calendar',
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
  storeState.definition = builtinDefinition();
});

describe('ScreenBuilder — ajuste de campo do sistema', () => {
  it('campo do sistema salva mesmo quando o estado tripa uma validação de opções', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());

    act(() => result.current.openEditField('deadlines', 'type'));
    expect(result.current.fieldModalIsNative).toBe(true);

    // Campo fixo do tipo seleção cujas opções vêm de um lookup — sem `staticOptions` e sem permitir
    // criação pelo usuário. Nenhum campo nativo está nessa combinação HOJE, mas um assim não pode
    // ficar impossível de ajustar quando for declarado no registry.
    act(() => result.current.updateFieldForm({
      label: 'Categoria',
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
    expect(screenKey).toBe('deadlines');
    expect(savedField('type')).toMatchObject({ label: 'Categoria', origin: 'builtin' });
  });

  it('materializa a declaração INTEIRA do campo do kernel na primeira edição', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());

    act(() => result.current.openEditField('deadlines', 'dueDate'));
    act(() => result.current.updateFieldForm({
      logicOnChange: 'object("apelido", name)',
      logicHiddenWhen: "type == 'PJ'",
    }));
    await act(async () => { await result.current.handleSaveField(); });

    expect(savedField('dueDate')).toMatchObject({
      key: 'dueDate',
      label: 'Data de vencimento',
      origin: 'builtin',
      required: true,
      logic: { hiddenWhen: "type == 'PJ'", onChange: 'object("apelido", name)' },
    });
  });

  it('grava regra e validação do campo do kernel — o backend lê a mesma lista', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());

    act(() => result.current.openEditField('deadlines', 'description'));
    act(() => result.current.updateFieldForm({ logicValidate: "if(isEmpty(value), 'Obrigatório', null)" }));
    await act(async () => { await result.current.handleSaveField(); });

    expect(savedField('description')?.logic?.validate).toBe("if(isEmpty(value), 'Obrigatório', null)");
  });

  it('preserva os ajustes dos outros campos ao salvar um', async () => {
    storeState.definition = builtinDefinition({
      fields: [{ key: 'notes', label: 'Observações do lançamento', type: 'text', required: false, order: 2, origin: 'builtin' }],
    });

    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('deadlines', 'dueDate'));
    act(() => result.current.updateFieldForm({ label: 'Vencimento do prazo' }));
    await act(async () => { await result.current.handleSaveField(); });

    expect(savedField('notes')?.label).toBe('Observações do lançamento');
    expect(savedField('dueDate')?.label).toBe('Vencimento do prazo');
  });

  it('restaurar padrão remove só a entrada daquele campo', async () => {
    storeState.definition = builtinDefinition({
      fields: [
        { key: 'dueDate', label: 'X', type: 'text', required: true, order: 1, origin: 'builtin' },
        { key: 'notes', label: 'Observações do lançamento', type: 'text', required: false, order: 2, origin: 'builtin' },
      ],
    });

    const { result } = renderHook(() => useScreenBuilderViewModel());
    await act(async () => { await result.current.restoreNativeField('deadlines', 'dueDate'); });

    expect(savedFields().map((f) => f.key)).toEqual(['notes']);
  });

  it('reordenar grava posições absolutas na mesma lista', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    await act(async () => { await result.current.moveField('deadlines', 'dueDate', 1); });

    const moved = savedField('dueDate');
    expect(moved?.origin).toBe('builtin');
    expect(typeof moved?.order).toBe('number');
  });

  /** A lista exibida vem da forma canônica do schema, que não carrega tudo que a autoria guarda. */
  it('reordenar preserva os ajustes de autoria do campo movido', async () => {
    storeState.definition = builtinDefinition({
      fields: [{
        key: 'apelido', label: 'Apelido', type: 'text', required: false, order: 21, origin: 'design',
        filterable: true, showInList: true, listLabel: 'Como chamar',
      }],
    });

    const { result } = renderHook(() => useScreenBuilderViewModel());
    await act(async () => { await result.current.moveField('deadlines', 'apelido', -1); });

    expect(savedField('apelido')).toMatchObject({ filterable: true, listLabel: 'Como chamar' });
  });

  it('campo novo entra na última posição da tela do kernel', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.selectScreen('deadlines'));
    const lastNativeOrder = (result.current.selectedScreen?.fields ?? [])
      .reduce((max, field) => Math.max(max, field.order), -1);

    act(() => result.current.openCreateField('deadlines'));
    act(() => result.current.updateFieldForm({ label: 'Apelido', fieldKey: 'apelido', type: 'text' }));
    await act(async () => { await result.current.handleSaveField(); });

    expect(lastNativeOrder).toBeGreaterThan(0);
    expect(savedField('apelido')?.order).toBe(lastNativeOrder + 1);
  });

  it('distingue campo do kernel de campo do usuário pela origem', () => {
    storeState.definition = builtinDefinition({
      fields: [{ key: 'apelido', label: 'Apelido', type: 'text', required: false, order: 0, origin: 'design' }],
    });

    const { result } = renderHook(() => useScreenBuilderViewModel());
    expect(result.current.isNativeField('deadlines', 'dueDate')).toBe(true);
    expect(result.current.isNativeField('deadlines', 'apelido')).toBe(false);
  });
});

/**
 * As telas FIXAS oferecidas pelo Form Design saem do registro, e não de uma lista escrita à mão.
 * Uma lista literal sobrevivia à entidade: Processo e Pessoa continuavam aparecendo como "tela do
 * sistema" depois de saírem do kernel — sem esquema por trás e sem extensão instalada.
 */
describe('ScreenBuilder — telas fixas vêm do registro', () => {
  it('lista exatamente as entidades do registro que aceitam campos', () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());

    const esperadas = ENTITY_REGISTRY_LIST
      .filter((entity) => entity.supportsCustomFields)
      .map((entity) => entity.collection)
      .sort();

    expect(result.current.builtinRows.map((row) => row.key).sort()).toStrictEqual(esperadas);
  });

  it('não oferece as entidades que saíram do kernel', () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    const keys = result.current.builtinRows.map((row) => row.key);

    expect(keys).not.toContain('persons');
    expect(keys).not.toContain('cases');
  });
});

/**
 * A tela de uma entidade que SAIU do kernel é ligada a outra coleção (`dataCollection`). Enquanto a
 * entidade era fixa, escondê-la fazia sentido: a linha fixa já a configurava. Fora do kernel, ela é
 * a única porta — e escondê-la deixou Pessoas e Processos sem nenhuma no Form Design.
 */
describe('ScreenBuilder — tela ligada a outra coleção', () => {
  const boundScreen = (overrides: Partial<ScreenDefinition> = {}): ScreenDefinition => ({
    id: 'pessoas', tenantId: 't1', origin: 'plugin', ownerPluginId: 'com.microteia.pessoa',
    titleSingular: 'Pessoa', titlePlural: 'Pessoas', icon: 'team',
    dataCollection: 'persons', titleFieldKey: 'name',
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true, order: 0, origin: 'plugin' },
      { key: 'cpf', label: 'CPF', type: 'masked', required: false, order: 1, origin: 'plugin' },
    ],
    hasNotes: true, hasDocuments: true, hasTags: true,
    listActions: [], viewActionIds: [], cardActionIds: [],
    sidebarOrder: 30, enabled: true, createdAt: new Date(), createdBy: 'u1', updatedAt: new Date(),
    ...overrides,
  });

  it('aparece na lista quando a coleção não é mais do kernel', () => {
    storeState.definition = boundScreen();
    const { result } = renderHook(() => useScreenBuilderViewModel());

    expect(result.current.dynamicListEntries.map((entry) => entry.key)).toContain('pessoas');
  });

  it('resolve os campos pela COLEÇÃO, e não pela chave da tela', () => {
    storeState.definition = boundScreen();
    const { result } = renderHook(() => useScreenBuilderViewModel());

    act(() => result.current.selectScreen('pessoas'));
    expect(result.current.selectedScreen?.fields.map((f) => f.key)).toStrictEqual(['name', 'cpf']);
  });

  it('uma visão sobre coleção AINDA do kernel continua fora — a linha fixa já a configura', () => {
    storeState.definition = boundScreen({ id: 'prazos-kanban', dataCollection: 'deadlines' });
    const { result } = renderHook(() => useScreenBuilderViewModel());

    expect(result.current.dynamicListEntries.map((entry) => entry.key)).not.toContain('prazos-kanban');
  });
});

/**
 * O que o modal oferece sai dos campos que a tela RENDERIZA, e um subtítulo aceita qualquer valor
 * que caiba numa linha. Restringir a texto deixava o campo declarado (`type`, uma seleção) fora da
 * lista — e o valor já gravado aparecia como "Registro não encontrado".
 */
describe('ScreenBuilder — campos oferecidos no modal da tela', () => {
  const pessoas = (): ScreenDefinition => ({
    id: 'pessoas', tenantId: 't1', origin: 'plugin', ownerPluginId: 'com.microteia.pessoa',
    titleSingular: 'Pessoa', titlePlural: 'Pessoas', icon: 'team',
    dataCollection: 'persons', titleFieldKey: 'name', subtitleFieldKey: 'type',
    fields: [
      { key: 'type', label: 'Tipo', type: 'select', required: true, order: 0, origin: 'plugin' },
      { key: 'name', label: 'Nome', type: 'text', required: true, order: 1, origin: 'plugin' },
      { key: 'cpf', label: 'CPF', type: 'masked', required: false, order: 2, origin: 'plugin' },
      { key: 'notes', label: 'Observações', type: 'textarea', required: false, order: 3, origin: 'plugin' },
    ],
    hasNotes: true, hasDocuments: true, hasTags: true,
    listActions: [], viewActionIds: [], cardActionIds: [],
    sidebarOrder: 30, enabled: true, createdAt: new Date(), createdBy: 'u1', updatedAt: new Date(),
  });

  it('oferece a seleção como subtítulo — o cartão resolve o rótulo dela', () => {
    storeState.definition = pessoas();
    const { result } = renderHook(() => useScreenBuilderViewModel());

    act(() => result.current.openEditScreen('pessoas'));

    expect(result.current.subtitleFieldOptions.map((o) => o.value)).toContain('type');
  });

  it('não oferece texto longo como subtítulo — não cabe numa linha', () => {
    storeState.definition = pessoas();
    const { result } = renderHook(() => useScreenBuilderViewModel());

    act(() => result.current.openEditScreen('pessoas'));

    expect(result.current.subtitleFieldOptions.map((o) => o.value)).not.toContain('notes');
  });
});
