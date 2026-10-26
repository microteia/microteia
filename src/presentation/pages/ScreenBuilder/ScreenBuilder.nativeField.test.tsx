// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScreenDefinition } from '../../../domain/entities';
import { createSchemaContext } from '../../../domain/schema/pathResolver';
import { ENTITY_REGISTRY_LIST } from '../../../domain/schema/entityRegistry';

/**
 * O que o Form Design oferece como TELA sai do registro e das telas do escritório — nunca de uma
 * lista escrita à mão. Prazo foi a última entidade do kernel a aceitar campos adicionais; com a
 * saída dela, nenhuma linha de "tela do sistema" resta, e toda tela ajustável é a de uma extensão
 * ou a do próprio escritório.
 */

const saveDefinition = vi.fn(async () => ({}) as ScreenDefinition);
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

beforeEach(() => {
  saveDefinition.mockClear();
  notify.mockClear();
  storeState.definition = undefined;
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
    expect(keys).not.toContain('deadlines');
  });
});

/**
 * A tela de uma entidade que SAIU do kernel é ligada a outra coleção (`dataCollection`). Enquanto a
 * entidade era fixa, escondê-la fazia sentido: a linha fixa já a configurava. Fora do kernel, ela é
 * a única porta — e escondê-la deixou Pessoas e Processos sem nenhuma no Form Design.
 */
describe('ScreenBuilder — tela ligada a outra coleção', () => {
  const boundScreen = (overrides: Partial<ScreenDefinition> = {}): ScreenDefinition => ({
    id: 'pessoas', tenantId: 't1', origin: 'plugin', ownerPluginId: 'com.example.cadastro',
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
});

/**
 * O que o modal oferece sai dos campos que a tela RENDERIZA, e um subtítulo aceita qualquer valor
 * que caiba numa linha. Restringir a texto deixava o campo declarado (`type`, uma seleção) fora da
 * lista — e o valor já gravado aparecia como "Registro não encontrado".
 */
describe('ScreenBuilder — campos oferecidos no modal da tela', () => {
  const pessoas = (): ScreenDefinition => ({
    id: 'pessoas', tenantId: 't1', origin: 'plugin', ownerPluginId: 'com.example.cadastro',
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
