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
const ensureRecordsStub = vi.fn();
vi.mock('../../../stores/useRecords', () => ({
  useRecords: () => ({
    recordsByCollection: { deadlines: state.records },
    knownRecordsByCollection: { deadlines: state.records },
    allRecords: state.records,
    ensureRecords: ensureRecordsStub,
    searchRecords: vi.fn(async () => []),
    isLoading: false,
    createRecord: vi.fn(),
    newRecordId: vi.fn(),
    updateRecord: vi.fn(),
    deleteRecord: vi.fn(),
  }),
}));
const abertas: string[] = [];
vi.mock('../../../stores/useWorkspace', () => ({ useWorkspace: () => ({ openTab: (key: string) => abertas.push(key) }) }));
vi.mock('../../../stores/useTenant', () => ({ useTenant: () => ({ members: [] }) }));
vi.mock('../../../infrastructure/di/useDI', () => ({ useDI: () => ({ recordRepository: { getById: vi.fn() } }) }));
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
let hostDoGesto: { parent: unknown; record: unknown } | null = null;
vi.mock('../recordActions/useRecordActions', async () => {
  const { RECORD_ACTION_METADATA } = await import('../../../domain/schema/ui/recordActionMetadata');
  return {
    useRecordActions: () => [
      {
        slot: 'copyLink',
        metadata: { key: 'copyLink', title: 'Copiar link', icon: 'link', order: 0 },
        run: (host: { recordTabKey: string }) => { copiado = host.recordTabKey; },
      },
      ...(['delete', 'unlink'] as const).map((key) => ({
        slot: RECORD_ACTION_METADATA[key].slot ?? key,
        metadata: RECORD_ACTION_METADATA[key],
        run: (host: { parent: unknown; record: unknown }) => { hostDoGesto = host; },
      })),
    ],
  };
});
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
  abertas.length = 0;
  hostDoGesto = null;
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

  it('na aba do pai, a ordem declarada vale em records E em filteredRecords', () => {
    state.records = [
      { ...record('a', 'Recurso', 'Pendente', 20), caseId: 'p1' },
      { ...record('b', 'Audiência', 'Vencido', 5), caseId: 'p1' },
      { ...record('x', 'Outro', 'Pendente', 1), caseId: 'p2' },
      { ...record('c', 'Petição', 'Pendente', 12), caseId: 'p1' },
    ] as EntityRecord[];
    const porVencimento = (x: EntityRecord, y: EntityRecord) =>
      (x.dueDate as Date).getTime() - (y.dueDate as Date).getTime();
    const { result } = listar(source({
      parent: { entityKey: 'cases', fieldKeys: ['caseId'], recordId: 'p1' },
      sortRecords: porVencimento,
    }));

    expect(result.current.records.map((r) => r.id)).toEqual(['b', 'c', 'a']);
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

/**
 * A aba de um pai que lista filhos com tela própria — os prazos de um processo. Enquanto a relação
 * olhava só a posse declarada, um vínculo obrigatório virava `related`: o cartão perdia Excluir e
 * ganhava Desvincular, que esvaziaria um campo que a validação exige.
 */
describe('useRecordListViewModel — relação com o pai', () => {
  const comVinculo = (required: boolean, extra: Partial<ScreenDefinition> = {}) => {
    const base = definition();
    state.definition = {
      ...base,
      listActions: ['delete'],
      fields: [
        ...base.fields,
        { key: 'caseId', label: 'Processo', type: 'reference', refEntity: 'cases', required, order: 2, origin: 'plugin' },
      ],
      ...extra,
    } as ScreenDefinition;
    state.records = [{ id: 'r1', type: 'Recurso', caseId: 'p1' } as unknown as EntityRecord];
  };
  const naAbaDoPai = () => listar(source({ parent: { entityKey: 'cases', fieldKeys: ['caseId'], recordId: 'p1' } }));
  const gestos = (result: ReturnType<typeof naAbaDoPai>['result']) =>
    result.current.getCardActions(state.records[0]).map((a) => a.key);

  it('vínculo obrigatório sem posse declarada: Excluir, e nunca Desvincular', () => {
    comVinculo(true);
    expect(gestos(naAbaDoPai().result)).toEqual(expect.arrayContaining(['delete']));
    expect(gestos(naAbaDoPai().result)).not.toContain('unlink');
  });

  it('a expressão vê `relation == "owned"` no vínculo obrigatório', () => {
    actionStore.actions = [{ id: 'a1', tenantId: 't1', key: 'k', title: 'só na posse', icon: 'apps', workflowId: 'w1', enabled: true, danger: false, order: 0, hiddenWhen: 'relation != "owned"', disabledWhen: null }];
    comVinculo(true, { cardActionIds: ['a1'] });
    expect(gestos(naAbaDoPai().result)).toContain('a1');
  });

  it('vínculo opcional sem posse: Desvincular, e não Excluir', () => {
    comVinculo(false);
    const keys = gestos(naAbaDoPai().result);
    expect(keys).toContain('unlink');
    expect(keys).not.toContain('delete');
  });
});

/**
 * O lado de lá de um vínculo muitos-para-muitos: os processos de que uma pessoa é parte, em qualquer
 * polo. A trava comparava UM campo por igualdade — num `multi` a lista ficava vazia, Desvincular
 * gravava `null` e apagava todas as partes, e o registro novo nascia solto.
 */
describe('useRecordListViewModel — trava por campo multi e por vários campos', () => {
  const comPolos = (extra: { required?: boolean } = {}) => {
    const base = definition();
    state.definition = {
      ...base,
      listActions: ['delete'],
      fields: [
        ...base.fields,
        { key: 'activePoleIds', label: 'Polo ativo', type: 'reference', refEntity: 'persons', multi: true, required: !!extra.required, order: 2, origin: 'plugin' },
        { key: 'passivePoleIds', label: 'Polo passivo', type: 'reference', refEntity: 'persons', multi: true, required: false, order: 3, origin: 'plugin' },
        { key: 'lawyerId', label: 'Advogado', type: 'reference', refEntity: 'persons', required: false, order: 4, origin: 'plugin' },
      ],
    } as ScreenDefinition;
    state.records = [
      { id: 'ativo', type: 'A', activePoleIds: ['pe1', 'pe2'], passivePoleIds: ['pe3'] },
      { id: 'passivo', type: 'B', activePoleIds: ['pe9'], passivePoleIds: ['pe1'] },
      { id: 'sozinho', type: 'C', activePoleIds: ['pe1'], passivePoleIds: [] },
      { id: 'alheio', type: 'D', activePoleIds: ['pe2'], passivePoleIds: ['pe3'] },
      { id: 'antigo', type: 'E', activePoleIds: 'pe1' },
    ] as unknown as EntityRecord[];
  };
  const dePessoa = (fieldKeys: string[]) =>
    listar(source({ parent: { entityKey: 'persons', fieldKeys, recordId: 'pe1' } }));
  const doRegistro = (id: string) => state.records.find((r) => r.id === id)!;

  it('num campo multi, entra o registro cuja lista CONTÉM o pai', () => {
    comPolos();
    expect(dePessoa(['activePoleIds']).result.current.records.map((r) => r.id))
      .toEqual(['ativo', 'sozinho', 'antigo']);
  });

  it('com vários campos, basta UM apontar — e nada se repete', () => {
    comPolos();
    expect(dePessoa(['activePoleIds', 'passivePoleIds']).result.current.records.map((r) => r.id))
      .toEqual(['ativo', 'passivo', 'sozinho', 'antigo']);
  });

  it('o campo multi continua no cartão e no filtro: os outros ids informam', () => {
    comPolos();
    const { result } = dePessoa(['activePoleIds']);
    expect(result.current.definition?.fields.map((f) => f.key)).toContain('activePoleIds');
    expect(result.current.getFieldText(doRegistro('ativo'), 'activePoleIds')).not.toBe('');
  });

  it('o registro novo nasce preso pelo PRIMEIRO campo', () => {
    comPolos();
    dePessoa(['passivePoleIds', 'activePoleIds']).result.current.openNewRecord();
    expect(abertas).toEqual(['new-dyn:prazos:parent:persons:pe1:passivePoleIds']);
  });

  it('Desvincular recebe todos os campos da trava', () => {
    comPolos();
    const { result } = dePessoa(['activePoleIds', 'passivePoleIds']);
    result.current.getCardActions(doRegistro('ativo')).find((a) => a.key === 'unlink')!.onClick();
    expect(hostDoGesto?.parent).toEqual({ fieldKeys: ['activePoleIds', 'passivePoleIds'], recordId: 'pe1', required: false });
  });

  it('multi obrigatório com outras partes: ainda é relação, e Desvincular aparece', () => {
    comPolos({ required: true });
    const keys = dePessoa(['activePoleIds']).result.current
      .getCardActions(doRegistro('ativo')).map((a) => a.key);
    expect(keys).toContain('unlink');
    expect(keys).not.toContain('delete');
  });

  it('multi obrigatório em que o pai é o ÚNICO id: posse, e Desvincular some', () => {
    comPolos({ required: true });
    const keys = dePessoa(['activePoleIds']).result.current
      .getCardActions(doRegistro('sozinho')).map((a) => a.key);
    expect(keys).toContain('delete');
    expect(keys).not.toContain('unlink');
  });

  it('um campo único continua escondido do cartão, como sempre', () => {
    comPolos();
    state.records = [{ id: 'r', type: 'A', lawyerId: 'pe1' } as unknown as EntityRecord];
    const { result } = dePessoa(['lawyerId']);
    expect(result.current.records.map((r) => r.id)).toEqual(['r']);
    expect(result.current.getFieldText(state.records[0], 'lawyerId')).toBe('');
    expect(result.current.getFieldText(state.records[0], 'type')).toBe('A');
  });
});

/**
 * A importação na aba do pai. O alvo da referência precisa ser uma entidade conhecida — aqui, a própria
 * coleção da tela (um prazo que aponta para o prazo de origem).
 */
describe('useRecordListViewModel — importar na aba do pai', () => {
  const comOrigem = () => {
    const base = definition();
    state.definition = {
      ...base,
      fields: [
        ...base.fields,
        { key: 'originId', label: 'Origem', type: 'reference', refEntity: 'deadlines', required: false, order: 2, origin: 'plugin' },
        { key: 'relatedIds', label: 'Relacionados', type: 'reference', refEntity: 'deadlines', multi: true, required: false, order: 3, origin: 'plugin' },
      ],
    } as ScreenDefinition;
  };
  const naAba = (fieldKeys: string[]) =>
    listar(source({ parent: { entityKey: 'deadlines', fieldKeys, recordId: 'd1' } })).result;

  it('presa por UM campo de referência única, oferece a importação com o pai já decidido', () => {
    comOrigem();
    const result = naAba(['originId']);
    expect(result.current.recordImport).toMatchObject({ isOpen: false, parent: { fieldKey: 'originId', recordId: 'd1' }, screenTitle: 'Prazos' });
    act(() => result.current.recordImport?.open());
    expect(result.current.recordImport?.isOpen).toBe(true);
    act(() => result.current.recordImport?.close());
    expect(result.current.recordImport?.isOpen).toBe(false);
  });

  it('não oferece numa trava multi, por vários campos, nem na lista própria da tela', () => {
    comOrigem();
    expect(naAba(['relatedIds']).current.recordImport).toBeNull();
    expect(naAba(['originId', 'relatedIds']).current.recordImport).toBeNull();
    expect(listar(source()).result.current.recordImport).toBeNull();
  });

  it('não oferece a quem não tem `record-import.run`, nem a quem não cria NEM altera', () => {
    comOrigem();
    auth.granted = ['deadlines.read', 'deadlines.create'];
    expect(naAba(['originId']).current.recordImport).toBeNull();
    auth.granted = ['deadlines.read', 'record-import.run'];
    expect(naAba(['originId']).current.recordImport).toBeNull();
    auth.granted = ['deadlines.read', 'deadlines.update', 'record-import.run'];
    expect(naAba(['originId']).current.recordImport).not.toBeNull();
  });
});

/**
 * O que o cartão DECLARADO (`cardTemplate`) pergunta à listagem. A promessa é de paridade: o mesmo
 * campo formatado do cartão padrão, e o `hiddenWhen` de um nó respondido como o de um botão.
 */
describe('useRecordListViewModel — perguntas do cartão declarado', () => {
  it('getCardFieldItem formata qualquer campo da tela, marcado para a listagem ou não', () => {
    const { result } = listar(source());
    const item = result.current.getCardFieldItem(record('r1', 'Recurso', 'Vencido', 1), 'status');
    expect(item).toMatchObject({ key: 'status', value: 'Vencido', type: 'text' });
    expect(item?.badges).toBeUndefined();
    expect(result.current.getCardFieldItem(record('r1', 'Recurso', 'Vencido', 1), 'sumiu')).toBeNull();
  });

  it('badges: true pede as etiquetas da opção mesmo sem optionsColored', () => {
    const { result } = listar(source());
    const item = result.current.getCardFieldItem(record('r1', 'Recurso', 'Vencido', 1), 'status', { badges: true });
    expect(item?.badges).toEqual([{ label: 'Vencido', color: undefined }]);
  });

  it('isCardNodeHidden responde como o hiddenWhen de uma ação do cartão, com o mesmo escopo', () => {
    auth.effectivePermissions = ['deadlines.delete'];
    const { result } = listar(source());
    const vencido = record('b', 'Audiência', 'Vencido', 5);
    expect(result.current.isCardNodeHidden(vencido, 'status == "Vencido"')).toBe(true);
    expect(result.current.isCardNodeHidden(vencido, 'status == "Pendente"')).toBe(false);
    expect(result.current.isCardNodeHidden(vencido, '!hasPermission("<entity>.delete")')).toBe(false);
    expect(result.current.isCardNodeHidden(vencido, 'surface == "list"')).toBe(true);
    expect(result.current.isCardNodeHidden(vencido, undefined)).toBe(false);
    expect(result.current.isCardNodeHidden(vencido, 'isso não parseia ((')).toBe(false);
  });

  it('cada ação diz por quais nomes um cartão declarado a escolhe', () => {
    actionStore.actions = [{ id: 'a1', tenantId: 't1', key: 'concluir', sourceId: 'com.acme:concluir', title: 'Concluir', icon: 'apps', workflowId: 'w1', enabled: true, danger: false, order: 0, hiddenWhen: null, disabledWhen: null }];
    state.definition = { ...definition(), listActions: ['copyLink'], cardActionIds: ['a1'] } as ScreenDefinition;

    const { result } = listar(source());
    expect(result.current.getCardActions(record('r1', 'Prazo', 'Pendente', 1)).map((action) => action.refs))
      .toEqual([['copyLink'], ['a1', 'concluir', 'com.acme:concluir']]);
  });

  it('a pré-visualização não consome o recado de "abrir já filtrada" da listagem de verdade', () => {
    setNavigationIntent('prazos', [{ key: 'status', values: ['Vencido'] }]);

    const preview = listar(source({ ignoreNavigationIntent: true }));
    expect(preview.result.current.filterTokens).toEqual([]);

    const { result } = listar(source());
    expect(result.current.filterTokens).toEqual([{ key: 'status', values: ['Vencido'] }]);
  });
});
