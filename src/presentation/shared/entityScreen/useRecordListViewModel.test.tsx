// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { setNavigationIntent } from '../../../infrastructure/navigation/navigationIntent';
import type { EntityRecord, ScreenDefinition } from '../../../domain/entities';

const state: { definition: ScreenDefinition | null; records: EntityRecord[] } = {
  definition: null,
  records: [],
};

vi.mock('styled-components', () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock('../../../stores/useScreenDefinitions', () => ({
  useScreenDefinitions: () => ({
    definitions: state.definition ? [state.definition] : [],
    dynamicScreens: state.definition ? [state.definition] : [],
    getDefinition: (id: string) => (state.definition?.id === id ? state.definition : undefined),
    isLoading: false,
  }),
}));
vi.mock('../../../stores/useRecords', () => ({
  useRecords: () => ({
    recordsByCollection: { deadlines: state.records },
    allRecords: state.records,
    isLoading: false,
    createRecord: vi.fn(),
    updateRecord: vi.fn(),
    deleteRecord: vi.fn(),
  }),
}));
vi.mock('../../../stores/useWorkspace', () => ({ useWorkspace: () => ({ openTab: vi.fn() }) }));
vi.mock('../../../stores/useTenant', () => ({ useTenant: () => ({ tenantRole: 'admin', members: [] }) }));
vi.mock('../../../stores/useNotification', () => ({ useNotification: () => ({ notify: vi.fn() }) }));
vi.mock('../../../stores/useActions', () => ({ useActions: () => ({ getActionsByIds: () => [], runAction: vi.fn() }) }));
vi.mock('../../../stores/useLookups', () => ({ useLookups: () => ({ getOptions: () => [], availableLookups: [] }) }));
vi.mock('../../../stores/useTags', () => ({ useTags: () => ({ getTags: () => [], availableTagLists: [], declareTagList: vi.fn(), setTags: vi.fn() }) }));
vi.mock('../recordActions/useRecordActions', () => ({ useRecordActions: () => [] }));

const { useRecordListViewModel } = await import('./useRecordListViewModel');

const definition = (): ScreenDefinition => ({
  id: 'prazos',
  tenantId: 't1',
  origin: 'plugin',
  titleSingular: 'Prazo',
  titlePlural: 'Prazos',
  icon: 'time',
  dataCollection: 'deadlines',
  titleFieldKey: 'type',
  fields: [
    { key: 'type', label: 'Tipo', type: 'text', required: true, order: 0, origin: 'plugin' },
    { key: 'status', label: 'Status', type: 'select', required: false, order: 1, origin: 'plugin', filterable: true, options: [{ key: 'Pendente', label: 'Pendente' }, { key: 'Vencido', label: 'Vencido' }] },
  ],
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
}) as ScreenDefinition;

const record = (id: string, type: string, status: string, dia: number): EntityRecord =>
  ({ id, type, status, dueDate: new Date(2026, 7, dia) }) as unknown as EntityRecord;

const listar = (source: Parameters<typeof useRecordListViewModel>[0]) =>
  renderHook(() => useRecordListViewModel(source));

beforeEach(() => {
  state.definition = definition();
  state.records = [
    record('a', 'Recurso', 'Pendente', 20),
    record('b', 'Audiência', 'Vencido', 5),
    record('c', 'Petição', 'Pendente', 12),
  ];
});

const source = (extra: Partial<Parameters<typeof useRecordListViewModel>[0]> = {}) => ({
  screenKey: 'prazos',
  savedFiltersKey: 'dyn:prazos',
  ...extra,
});

/**
 * A ordem da coleção é a de cadastro (mais recente primeiro), que serve a um cadastro e não a uma
 * agenda: uma lista de prazos se lê do vencimento mais próximo ao mais distante.
 */
describe('useRecordListViewModel — ordenação', () => {
  it('sem comparador, a ordem é a que a coleção entrega', () => {
    const { result } = listar(source());
    expect(result.current.filteredRecords.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('o comparador declarado reordena a lista já filtrada', () => {
    const porVencimento = (x: EntityRecord, y: EntityRecord) =>
      (x.dueDate as Date).getTime() - (y.dueDate as Date).getTime();
    const { result } = listar(source({ sortRecords: porVencimento }));
    expect(result.current.filteredRecords.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });
});

/**
 * Abrir a listagem JÁ FILTRADA. O recado é endereçado pela chave da TELA, e chega por dois caminhos
 * porque são duas situações: a aba que ainda vai abrir e a que já está aberta.
 */
describe('useRecordListViewModel — intenção de navegação', () => {
  it('a listagem abre com o filtro deixado antes de ela montar', () => {
    setNavigationIntent('prazos', [{ key: 'status', values: ['Vencido'] }]);

    const { result } = listar(source());
    expect(result.current.filterTokens).toEqual([{ key: 'status', values: ['Vencido'] }]);
    expect(result.current.filteredRecords.map((r) => r.id)).toEqual(['b']);
  });

  it('o recado é consumido: remontar não reaplica o filtro de antes', () => {
    setNavigationIntent('prazos', [{ key: 'status', values: ['Vencido'] }]);
    listar(source());

    const { result } = listar(source());
    expect(result.current.filterTokens).toEqual([]);
  });

  it('a listagem JÁ ABERTA recebe o novo filtro pela assinatura', () => {
    const { result } = listar(source());
    expect(result.current.filteredRecords).toHaveLength(3);

    act(() => setNavigationIntent('prazos', [{ key: 'status', values: ['Vencido'] }]));

    expect(result.current.filterTokens).toEqual([{ key: 'status', values: ['Vencido'] }]);
    expect(result.current.filteredRecords.map((r) => r.id)).toEqual(['b']);
  });

  it('sem recado, valem os filtros de partida declarados pela tela', () => {
    const { result } = listar(source({ defaultFilterTokens: [{ key: 'status', values: ['Pendente'] }] }));
    expect(result.current.filteredRecords.map((r) => r.id)).toEqual(['a', 'c']);
  });
});
