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
    newRecordId: vi.fn(),
    updateRecord: vi.fn(),
    deleteRecord: vi.fn(),
  }),
}));
vi.mock('../../../stores/useWorkspace', () => ({ useWorkspace: () => ({ openTab: vi.fn() }) }));
vi.mock('../../../stores/useTenant', () => ({ useTenant: () => ({ members: [] }) }));
// `granted: null` é "pode tudo", que é o que quase todo teste daqui pressupõe; a lista fecha o cerco
// só onde a permissão É o assunto.
const auth = { effectivePermissions: [] as string[], granted: null as string[] | null };
vi.mock('../../../stores/useAuthorization', () => ({
  useAuthorization: () => ({
    can: (permission: string) => auth.granted === null || auth.granted.includes(permission),
    canAny: () => true,
    canAll: () => true,
    explicitPermissions: [],
    effectivePermissions: auth.effectivePermissions,
  }),
}));
vi.mock('../../../stores/useNotification', () => ({ useNotification: () => ({ notify: vi.fn() }) }));
const actionStore: { actions: Record<string, unknown>[] } = { actions: [] };
vi.mock('../../../stores/useActions', () => ({
  useActions: () => ({
    getActionsByIds: (ids: string[]) =>
      ids.map((id) => actionStore.actions.find((a) => (a as { id: string }).id === id)).filter(Boolean),
    runAction: vi.fn(),
  }),
}));
vi.mock('../../../stores/useLookups', () => ({ useLookups: () => ({ getOptions: () => [], availableLookups: [] }) }));
vi.mock('../../../stores/useTags', () => ({ useTags: () => ({ getTags: () => [], availableTagLists: [], declareTagList: vi.fn(), setTags: vi.fn() }) }));
vi.mock('../../../stores/useWorkflowStore', () => ({ useWorkflowStore: () => ({ workflows: [] }) }));
let copiado = '';
vi.mock('../recordActions/useRecordActions', () => ({
  useRecordActions: () => [{
    slot: 'copyLink',
    metadata: { key: 'copyLink', title: 'Copiar link', icon: 'link', order: 0 },
    run: (host: { recordTabKey: string }) => { copiado = host.recordTabKey; },
  }],
}));
vi.mock('../../../stores/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', photoURL: null }, userRole: 'USER', effectiveName: 'Fulano' }),
}));

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
  actionStore.actions = [];
  auth.effectivePermissions = [];
  auth.granted = null;
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
 * Ver a tela é ler a coleção dela, e a coleção pode não levar o nome da tela. Enquanto a listagem não
 * respondia isso, a aba salva de quem perdeu o acesso abria uma lista que o servidor mantinha vazia —
 * o menu já não oferecia a tela, mas o link ainda a alcançava.
 */
describe('useRecordListViewModel — permissão de ler', () => {
  it('a permissão cobrada é da COLEÇÃO da tela, não da chave dela', () => {
    auth.granted = ['deadlines.read'];
    expect(listar(source()).result.current.canRead).toBe(true);

    auth.granted = ['prazos.read'];
    expect(listar(source()).result.current.canRead).toBe(false);
  });

  it('sem a permissão, as quatro respostas são NÃO — não só a de ler', () => {
    auth.granted = [];
    const vm = listar(source()).result.current;

    expect([vm.canRead, vm.canCreate, vm.canUpdate, vm.canDeleteRecords])
      .toEqual([false, false, false, false]);
  });
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

/**
 * O ENDEREÇO de um registro é o que a tela declara. Sem isto, a auditoria e as menções abriam a tela
 * de leitura de uma notícia enquanto "copiar link" copiava o endereço do formulário: o mesmo registro
 * com dois endereços, e o da área de transferência não era o que o usuário estava vendo.
 */
describe('useRecordListViewModel — endereço do registro', () => {
  it('sem prefixo declarado, copiar link usa a aba genérica', () => {
    state.definition = { ...definition(), listActions: ['copyLink'] } as ScreenDefinition;
    const { result } = listar(source());

    result.current.getCardActions(state.records[0]).find((a) => a.key === 'copyLink')!.onClick();
    expect(copiado).toBe('view-dyn:prazos:a');
  });

  it('com `recordTabPrefix`, copiar link aponta para a tela que a declaração escolheu', () => {
    state.definition = {
      ...definition(),
      listActions: ['copyLink'],
      recordTabPrefix: 'news-read:',
    } as ScreenDefinition;
    const { result } = listar(source());

    result.current.getCardActions(state.records[0]).find((a) => a.key === 'copyLink')!.onClick();
    expect(copiado).toBe('news-read:a');
  });

  it('o host da lista ainda vence a declaração, para a extensão que endereça diferente', () => {
    state.definition = { ...definition(), listActions: ['copyLink'], recordTabPrefix: 'news-read:' } as ScreenDefinition;
    const { result } = listar(source({
      recordTabKeys: (id: string) => ({ view: `proprio:${id}`, clone: `proprio:clone:${id}` }),
    }));

    result.current.getCardActions(state.records[0]).find((a) => a.key === 'copyLink')!.onClick();
    expect(copiado).toBe('proprio:a');
  });
});

/**
 * A ação CUSTOMIZADA no cartão da listagem. O teste nasceu de um relato: a mesma ação, habilitada
 * nos dois lugares do Form Design, aparecia no cabeçalho do registro e não no cartão.
 */
describe('useRecordListViewModel — ações customizadas do cartão', () => {
  const acao = (over: Record<string, unknown> = {}) => ({
    id: 'a1',
    tenantId: 't1',
    key: 'teste',
    title: 'teste permission',
    icon: 'apps',
    workflowId: 'w1',
    enabled: true,
    danger: false,
    order: 0,
    hiddenWhen: null,
    disabledWhen: null,
    ...over,
  });

  it('a ação habilitada em `cardActionIds` aparece no cartão', () => {
    actionStore.actions = [acao()];
    state.definition = { ...definition(), cardActionIds: ['a1'] } as ScreenDefinition;

    const { result } = listar({ screenKey: 'prazos', savedFiltersKey: 'prazos' });
    const acoes = result.current.getCardActions(record('r1', 'Prazo', 'Pendente', 1));
    expect(acoes.map((a) => a.key)).toContain('a1');
  });

  it('`hiddenWhen` verdadeiro esconde a ação do cartão', () => {
    actionStore.actions = [acao({ hiddenWhen: 'true' })];
    state.definition = { ...definition(), cardActionIds: ['a1'] } as ScreenDefinition;

    const { result } = listar({ screenKey: 'prazos', savedFiltersKey: 'prazos' });
    expect(result.current.getCardActions(record('r1', 'Prazo', 'Pendente', 1))).toEqual([]);
  });

  it('`disabledWhen` verdadeiro mantém a ação VISÍVEL, apenas desabilitada', () => {
    actionStore.actions = [acao({ disabledWhen: 'true' })];
    state.definition = { ...definition(), cardActionIds: ['a1'] } as ScreenDefinition;

    const { result } = listar({ screenKey: 'prazos', savedFiltersKey: 'prazos' });
    const [acaoCartao] = result.current.getCardActions(record('r1', 'Prazo', 'Pendente', 1));
    expect(acaoCartao).toMatchObject({ key: 'a1', disabled: true });
  });

  /**
   * O teste que pegou o defeito: as permissões chegam pelo CONTEXTO da avaliação. Enquanto vinham de
   * um gate de módulo empurrado por efeito, a primeira pintura da listagem avaliava com o conjunto
   * vazio e a ação sumia do cartão para sempre.
   */
  it('hasPermission no cartão enxerga a coleção da tela e as permissões de quem olha', () => {
    auth.effectivePermissions = ['deadlines.delete'];
    actionStore.actions = [acao({ hiddenWhen: '!hasPermission("<entity>.delete")' })];
    state.definition = { ...definition(), cardActionIds: ['a1'] } as ScreenDefinition;

    const { result } = listar({ screenKey: 'prazos', savedFiltersKey: 'prazos' });
    expect(result.current.getCardActions(record('r1', 'Prazo', 'Pendente', 1)).map((a) => a.key))
      .toContain('a1');
  });

  /**
   * O `confirmMessage` era honrado no cabeçalho do registro e ignorado no cartão: a mesma ação
   * perguntava num lugar e disparava direto no outro.
   */
  it('a ação com `confirmMessage` PERGUNTA antes de disparar, também no cartão', () => {
    actionStore.actions = [acao({ confirmMessage: 'Tem certeza?' })];
    state.definition = { ...definition(), cardActionIds: ['a1'] } as ScreenDefinition;

    const { result } = listar({ screenKey: 'prazos', savedFiltersKey: 'prazos' });
    const registro = record('r1', 'Prazo', 'Pendente', 1);
    const [acaoCartao] = result.current.getCardActions(registro);

    expect(result.current.pendingCardAction).toBeNull();
    act(() => acaoCartao.onClick());
    expect(result.current.pendingCardAction).toMatchObject({
      action: expect.objectContaining({ id: 'a1' }),
      record: expect.objectContaining({ id: 'r1' }),
    });

    act(() => result.current.cancelPendingCardAction());
    expect(result.current.pendingCardAction).toBeNull();
  });

  it('sem `confirmMessage`, o clique dispara direto', () => {
    actionStore.actions = [acao()];
    state.definition = { ...definition(), cardActionIds: ['a1'] } as ScreenDefinition;

    const { result } = listar({ screenKey: 'prazos', savedFiltersKey: 'prazos' });
    const [acaoCartao] = result.current.getCardActions(record('r1', 'Prazo', 'Pendente', 1));

    act(() => acaoCartao.onClick());
    expect(result.current.pendingCardAction).toBeNull();
  });

  /**
   * O DONO do escritório não tem perfil nenhum: o que ele tem é o curinga. Enquanto o conjunto
   * efetivo saía sem ele, `can()` deixava o dono passar e `hasPermission` na mesma tela dizia que
   * não — a mesma pergunta com duas respostas conforme por onde se perguntasse.
   */
  it('o curinga do dono responde SIM a qualquer padrão na expressão', () => {
    auth.effectivePermissions = ['*'];
    actionStore.actions = [acao({ hiddenWhen: '!hasPermission("<entity>.delete")' })];
    state.definition = { ...definition(), cardActionIds: ['a1'] } as ScreenDefinition;

    const { result } = listar({ screenKey: 'prazos', savedFiltersKey: 'prazos' });
    expect(result.current.getCardActions(record('r1', 'Prazo', 'Pendente', 1)).map((a) => a.key))
      .toContain('a1');
  });

  it('sem a permissão, a mesma expressão esconde a ação do cartão', () => {
    auth.effectivePermissions = ['deadlines.read'];
    actionStore.actions = [acao({ hiddenWhen: '!hasPermission("<entity>.delete")' })];
    state.definition = { ...definition(), cardActionIds: ['a1'] } as ScreenDefinition;

    const { result } = listar({ screenKey: 'prazos', savedFiltersKey: 'prazos' });
    expect(result.current.getCardActions(record('r1', 'Prazo', 'Pendente', 1))).toEqual([]);
  });
});
