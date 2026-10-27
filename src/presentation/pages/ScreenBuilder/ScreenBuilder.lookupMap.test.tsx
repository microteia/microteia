// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FieldDefinition, ScreenDefinition } from '../../../domain/entities';
import { createSchemaContext } from '../../../domain/schema/pathResolver';

import { DATA_EXTERNAL_LOOKUP_POINT, lookupProviderContribution } from '../../../domain/schema/dataExtensionPoints';

/**
 * O destino por chave da busca externa (`onChangeLookup.map`) no Form Design.
 *
 * O que se exercita é a ida e volta: um campo de extensão com `map` aberto e salvo sem mexer na busca
 * não pode perder a declaração — era o risco de o formulário só conhecer o prefixo —; escolher destinos
 * grava o `map` no lugar do prefixo; e trocar de provedor recomeça o mapa.
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
const VIACEP = lookupProviderContribution({
  key: 'viacep',
  label: 'CEP',
  request: { url: 'https://viacep.com.br/ws/{value}/json/' },
  map: { street: 'logradouro', neighborhood: 'bairro', city: 'localidade', state: 'uf' },
});
const OTHER = lookupProviderContribution({
  key: 'com.acme/cnpj',
  label: 'CNPJ',
  request: { url: 'https://cnpj.example.com/{value}' },
  map: { name: 'razao' },
});

vi.mock('../../../stores/useKernel', () => ({
  useContributions: (point: string) => (point === DATA_EXTERNAL_LOOKUP_POINT ? [VIACEP, OTHER] : []),
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

const contribuintes = (fields: FieldDefinition[]): ScreenDefinition => ({
  id: 'contribuintes',
  tenantId: 't1',
  origin: 'design',
  titleSingular: 'Contribuinte',
  titlePlural: 'Contribuintes',
  icon: 'person',
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

const savedLookup = () =>
  saveDefinition.mock.calls.at(-1)?.[1].fields.find((one) => one.key === 'enderecoCep')?.logic?.onChangeLookup;

const FLAT_MAP = { street: 'enderecoLogradouro', city: 'enderecoMunicipio' };

const screenWith = (cep: Partial<FieldDefinition>) => contribuintes([
  field({ key: 'nome', label: 'Nome', required: true, order: 0 }),
  field({ key: 'enderecoCep', label: 'CEP', order: 1, ...cep }),
  field({ key: 'enderecoLogradouro', label: 'Logradouro', order: 2 }),
  field({ key: 'enderecoMunicipio', label: 'Município', order: 3 }),
  field({ key: 'resumo', label: 'Resumo', order: 4, logic: { compute: 'concat(nome)' } }),
]);

beforeEach(() => {
  saveDefinition.mockClear();
  notify.mockClear();
  storeState.definition = screenWith({});
});

describe('ScreenBuilder — o destino por chave da busca externa', () => {
  it('um map já declarado sobrevive a abrir e salvar o campo', async () => {
    storeState.definition = screenWith({ logic: { onChangeLookup: { provider: 'viacep', map: FLAT_MAP } } });
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('contribuintes', 'enderecoCep'));
    expect(result.current.lookupMapped).toBe(true);
    expect(result.current.lookupTargetRows).toEqual([
      { output: 'street', target: 'enderecoLogradouro' },
      { output: 'neighborhood', target: '' },
      { output: 'city', target: 'enderecoMunicipio' },
      { output: 'state', target: '' },
    ]);
    await act(async () => { await result.current.handleSaveField(); });
    expect(savedLookup()).toEqual({ provider: 'viacep', map: FLAT_MAP });
  });

  it('o prefixo de quem já usa continua gravado como era', async () => {
    storeState.definition = screenWith({ logic: { onChangeLookup: { provider: 'viacep', targetPrefix: 'address' } } });
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('contribuintes', 'enderecoCep'));
    expect(result.current.lookupMapped).toBe(false);
    await act(async () => { await result.current.handleSaveField(); });
    expect(savedLookup()).toEqual({ provider: 'viacep', targetPrefix: 'address' });
  });

  it('escolher destinos grava o map no lugar do prefixo, e desfazer volta ao prefixo', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('contribuintes', 'enderecoCep'));
    act(() => result.current.selectLookupProvider('viacep'));
    act(() => result.current.updateFieldForm({ lookupTargetPrefix: 'endereco' }));
    act(() => result.current.setLookupTarget('street', 'enderecoLogradouro'));
    expect(result.current.lookupMapped).toBe(true);
    await act(async () => { await result.current.handleSaveField(); });
    expect(savedLookup()).toEqual({ provider: 'viacep', map: { street: 'enderecoLogradouro' } });

    act(() => result.current.openEditField('contribuintes', 'enderecoCep'));
    act(() => result.current.selectLookupProvider('viacep'));
    act(() => result.current.updateFieldForm({ lookupTargetPrefix: 'endereco' }));
    act(() => result.current.setLookupTarget('street', 'enderecoLogradouro'));
    act(() => result.current.setLookupTarget('street', ''));
    await act(async () => { await result.current.handleSaveField(); });
    expect(savedLookup()).toEqual({ provider: 'viacep', targetPrefix: 'endereco' });
  });

  it('trocar de provedor recomeça o mapa', () => {
    storeState.definition = screenWith({ logic: { onChangeLookup: { provider: 'viacep', map: FLAT_MAP } } });
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('contribuintes', 'enderecoCep'));
    act(() => result.current.selectLookupProvider('com.acme/cnpj'));
    expect(result.current.fieldForm.lookupMap).toEqual({});
    expect(result.current.lookupTargetRows).toEqual([{ output: 'name', target: '' }]);
  });

  it('oferece como destino os campos da tela, menos o próprio e o calculado', () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('contribuintes', 'enderecoCep'));
    expect(result.current.lookupTargetOptions.map((option) => option.value))
      .toEqual(['', 'nome', 'enderecoLogradouro', 'enderecoMunicipio']);
  });
});
