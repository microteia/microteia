import { useMemo, useState, useCallback, useEffect } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useRecords } from '../../../stores/useRecords';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useAuthorization } from '../../../stores/useAuthorization';
import { useNotification } from '../../../stores/useNotification';
import { useActions } from '../../../stores/useActions';
import { useRecordDialog } from '../../../stores/useRecordDialog';
import { storeEvents, StoreEvents } from '../../../infrastructure/events/StoreEventEmitter';
import type { ActionExprContext } from '../../../domain/schema/actionExpression';
import { actionActiveState, isActionDisabled, isActionHidden } from '../../../domain/schema/actionExpression';
import type { ActionRelation, ActionSurface } from '../../../domain/schema/actionExpression';
import { dispatchActionOutcome, localizeActionOutcome } from './useScreenActions';
import { useActionParameterPrompt } from './useActionParameterPrompt';
import type { ActionParameterPromptController } from './useActionParameterPrompt';
import { useCustomFieldListing } from '../../hooks/useCustomFieldListing';
import { useRecordIdentityText } from './useRecordIdentityText';
import type { CustomFieldCardItem } from '../../hooks/useCustomFieldListing';
import { buildNewTabKey, buildViewTabKey, buildCloneTabKey, buildChildNewTabKey, recordTabKeyOf } from '../../../shared/constants/dynamicScreenKeys';
import { readValueByPath, recordExpressionValues, resolveRecordImageUrl, resolveRecordTitle, sortFieldsByOrder } from '../../../domain/services/customFieldValues';
import { isBoundScreen, parentLinkRelation, screenDataCollection } from '../../../domain/services/screenDataCollection';
import { collectionPermissionId } from '../../../domain/schema/access';
import { screenForDisplay, useEntityFormFields, useResolvedFields } from '../useEntityFormFields';
import { useExprViewer } from '../useExprViewer';
import { useActionReferences } from '../useActionReferences';
import { useSchemaContext } from '../useSchemaContext';
import { useRecordActions } from '../recordActions/useRecordActions';
import { inScreenOrder } from '../recordActions/screenOrder';
import type { RecordActionHost } from '../recordActions/recordActionHost';
import { deriveListRows } from '../deriveEntitySchema';
import { consumeNavigationIntent, subscribeNavigationIntent } from '../../../infrastructure/navigation/navigationIntent';
import type { ActionDefinition, ActionStatusCode, CustomFieldValue, EntityRecord, ScreenDefinition, Tag } from '../../../domain/entities';
import type { TagStoreAdapter } from '../../components/ui/TagManager';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';
import { useTagAdapter, useTagCollection } from './useTagAdapter';
import { useTags } from '../../../stores/useTags';

import { useT, useLabel } from '../i18n/useT';

const STATUS_TONE: Record<ActionStatusCode, 'success' | 'warning' | 'error'> = {
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
};

export interface RecordCardAction {
  key: string;
  title: string;
  danger?: boolean;
  disabled?: boolean;
  /** Estado do interruptor, quando a ação declara `activeWhen` — o mesmo que o cabeçalho do registro mostra. */
  active?: boolean;
  /** Presente nas ações customizadas — a view resolve pelo registro de ícones das telas. */
  iconKey?: string;
  onClick: () => void;
}

/** Registro pai quando a listagem é a aba de filhos de um registro. */
export interface RecordListParent {
  entityKey: string;
  fieldKey: string;
  recordId: string;
}

export interface RecordListSource {
  screenKey: string;
  /** Chave dos filtros salvos do CompositeFilter. */
  savedFiltersKey: string;
  parent?: RecordListParent;
  /**
   * Como esta tela ENDEREÇA um registro. Ausente, valem as abas genéricas (`view-dyn:`); uma
   * extensão com editor próprio passa as dela, e as ações de copiar link e duplicar apontam para
   * lá sem que nenhuma delas precise saber que existe uma extensão.
   */
  recordTabKeys?: (recordId: string) => { view: string; clone: string };
  /** Filtros com que a listagem abre. Ver `EntityListOptions.defaultFilterTokens`. */
  defaultFilterTokens?: FilterToken[];
  /** Ordem de `records` e de `filteredRecords`. Ver `EntityListOptions.sortRecords`. */
  sortRecords?: (a: EntityRecord, b: EntityRecord) => number;
}

export interface RecordListViewModel {
  definition: ScreenDefinition | null;
  /** Coleção dos registros — a chave da tela, ou a coleção alvo quando ela é uma visão. */
  collection: string;
  isAvailable: boolean;
  isLoading: boolean;
  records: EntityRecord[];
  filteredRecords: EntityRecord[];
  filterTokens: FilterToken[];
  filterDefs: FilterDef[];
  savedFiltersScreenKey: string;
  tags: Tag[];
  setFilterTokens: (tokens: FilterToken[]) => void;
  /**
   * O que esta pessoa pode fazer NESTA coleção. A listagem esconde o que a regra recusaria: oferecer
   * o botão e deixar o servidor negar depois é pedir que alguém descubra o próprio acesso por
   * tentativa e erro.
   *
   * `canRead` é o de fora: sem ele não há lista, e a superfície diz isso em vez de mostrar o vazio
   * que a regra do servidor produz — o menu já não oferece a tela, mas a aba salva e o link ainda a
   * alcançam, e chegar a uma lista vazia sem explicação é o mesmo defeito por outra porta.
   */
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDeleteRecords: boolean;
  openNewRecord: () => void;
  openRecord: (record: EntityRecord) => void;
  getCardItems: (record: EntityRecord) => CustomFieldCardItem[];
  getCardTitle: (record: EntityRecord) => string;
  /** Texto do campo declarado como subtítulo (`subtitleFieldKey`), já resolvido para rótulo. */
  getCardSubtitle: (record: EntityRecord) => string;
  /** Ícone da linha de subtítulo do card, quando o campo declara um. */
  cardSubtitleIconKey: string | null;
  /**
   * O texto de QUALQUER campo da tela, formatado pelo tipo dele (moeda, data, rótulo da opção, nome
   * do registro referenciado) — não só dos marcados para a listagem. Vazio quando o campo não existe
   * ou não tem valor, para quem compõe a própria linha poder simplesmente pulá-lo.
   */
  getFieldText: (record: EntityRecord, fieldKey: string) => string;
  /**
   * A imagem do registro (`imageFieldKey`), que substitui o ícone da tela no avatar do card. Nada
   * declarado, campo vazio ou campo que deixou de ser de arquivo → `null`, e o card volta ao ícone.
   */
  getCardImageUrl: (record: EntityRecord) => string | null;
  getCardActions: (record: EntityRecord) => RecordCardAction[];
  /** O pedido de parâmetros de uma ação que pergunta antes de executar. Renderizado pelos modais. */
  parameterPrompt: ActionParameterPromptController;
  /**
   * A ação do cartão que PEDE CONFIRMAÇÃO, esperando resposta. O detalhe já honrava
   * `confirmMessage`; o cartão disparava direto — a mesma ação perguntava num lugar e não no outro.
   */
  pendingCardAction: { action: ActionDefinition; record: EntityRecord } | null;
  confirmPendingCardAction: () => void;
  cancelPendingCardAction: () => void;
  tagAdapter: TagStoreAdapter;
  tagManagerRecord: EntityRecord | null;
  closeTagManager: () => void;
  recordToDelete: EntityRecord | null;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  isDeleting: boolean;
}

/**
 * Listagem de registros de uma tela customizada, independente de onde aparece: janela própria
 * (`DynamicRecordList`) ou aba de registros filhos dentro do pai (`ChildRecordList`).
 * Com `parent`, a lista é restrita aos filhos daquele registro e o "novo" já nasce vinculado.
 */
export const useRecordListViewModel = (source: RecordListSource): RecordListViewModel => {
  const { screenKey, savedFiltersKey, parent, recordTabKeys, defaultFilterTokens, sortRecords } = source;
  const { getDefinition, isLoading: definitionsLoading } = useScreenDefinitions();
  const { recordsByCollection, isLoading: recordsLoading, updateRecord, deleteRecord } = useRecords();
  const { openTab } = useWorkspace();
  const { can, effectivePermissions } = useAuthorization();
  const { notify } = useNotification();
  const t = useT('core.records');
  const label = useLabel();
  const { getActionsByIds, runAction } = useActions();
  const viewer = useExprViewer();
  const references = useActionReferences();

  /**
   * Abrir a listagem JÁ FILTRADA: o painel manda ver "prazos vencidos", o cartão de um push manda ver
   * os prazos daquele processo. O recado é endereçado pela CHAVE DA TELA, e quem o deixa não precisa
   * conhecê-la — resolve a coleção e fala com quem a descreve (`useOpenScreenList`).
   *
   * São dois caminhos porque são duas situações: a aba que ainda vai abrir recebe o recado guardado
   * (`consume`, na primeira montagem), e a que já está aberta recebe pela assinatura — sem ela, clicar
   * de novo no painel traria a mesma tela com o filtro anterior.
   */
  const [filterTokens, setFilterTokens] = useState<FilterToken[]>(
    () => (screenKey ? consumeNavigationIntent(screenKey) as FilterToken[] | undefined : undefined)
      ?? defaultFilterTokens
      ?? [],
  );
  const [tagManagerRecord, setTagManagerRecord] = useState<EntityRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<EntityRecord | null>(null);
  const [pendingCardAction, setPendingCardAction] = useState<{ action: ActionDefinition; record: EntityRecord } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [runningActionId, setRunningActionId] = useState<string | null>(null);

  useEffect(
    () => (screenKey
      ? subscribeNavigationIntent(screenKey, (tokens) => setFilterTokens(tokens as FilterToken[]))
      : undefined),
    [screenKey],
  );

  const stored = useMemo(() => getDefinition(screenKey) ?? null, [getDefinition, screenKey]);
  const definition = useMemo(() => screenForDisplay(stored, label), [stored, label]);
  const isAvailable = !!definition && definition.origin !== 'builtin' && definition.enabled;

  // Onde os registros vivem. Numa tela BOUND é a coleção de outra entidade — daí toda leitura,
  // gravação, etiqueta e ação abaixo usar `collection`, e não a chave da tela.
  const collection = definition ? screenDataCollection(definition) : screenKey;
  const isBound = !!definition && isBoundScreen(definition);

  // Numa tela ligada a outra coleção, os campos vêm da COLEÇÃO — a declaração dela própria somada à
  // de quem mais a descreva (o registro do kernel enquanto existir, e os ajustes do escritório).
  const boundFields = useEntityFormFields(isBound ? collection : '');
  const schemaContext = useSchemaContext();

  // Na aba do pai, todos os registros têm o mesmo vínculo: filtrar ou exibir esse campo não
  // informa nada. É o mesmo motivo pelo qual ele não vai ao formulário do filho.
  const allFields = useMemo(
    () => (!definition ? [] : isBound ? boundFields.fields : sortFieldsByOrder(definition.fields)),
    [definition, isBound, boundFields.fields],
  );
  const declaredFields = useMemo(
    () => (parent ? allFields.filter((field) => field.key !== parent.fieldKey) : allFields),
    [allFields, parent],
  );
  const parentLinkField = useMemo(
    () => (parent ? allFields.find((field) => field.key === parent.fieldKey) : undefined),
    [allFields, parent],
  );
  // Rótulo declarativo resolve NOS DOIS ramos — é dele que saem os filtros e as linhas do cartão, e
  // uma referência crua apareceria no filtro salvo do escritório. Ver `useResolvedFields`.
  const sortedFields = useResolvedFields(declaredFields);

  // Campo que já é meta-linha do card (tem ícone de listagem declarado) não se repete no bloco de
  // campos adicionais — seria a mesma informação duas vezes no cartão.
  const listRowKeys = useMemo(
    () => new Set(deriveListRows(schemaContext, collection).map((row) => row.key)),
    [schemaContext, collection],
  );

  const listing = useCustomFieldListing(sortedFields);

  // Sem ordem declarada vale a da coleção (mais recente primeiro). A tela cuja leitura DEPENDE da
  // ordem — uma agenda de prazos se lê do mais próximo ao mais distante — informa a sua, e ela vale
  // nas DUAS listas: `filteredRecords` sai daqui pelo `filter`, que preserva a ordem. Ordenar só a
  // filtrada deixava `records` na ordem da coleção, e duas abas de registro saíram fora de ordem
  // desenhando `records`.
  const records = useMemo(() => {
    const all = recordsByCollection[collection] ?? [];
    const locked = parent ? all.filter((record) => record[parent.fieldKey] === parent.recordId) : all;
    return sortRecords ? [...locked].sort(sortRecords) : locked;
  }, [recordsByCollection, collection, parent, sortRecords]);


  const tagCollection = useTagCollection(collection, definition?.tagCollection);
  const tags = useTags().getTags(tagCollection);

  const tagOptions = useMemo<FilterDef['options']>(() =>
    tags.map((t) => ({ value: t.id, label: t.name, color: t.color })),
    [tags],
  );

  const filterDefs = useMemo<FilterDef[]>(() => [
    { key: 'search', label: t('core.ui/filter.search'), type: 'text', placeholder: t('core.ui/action.search') },
    ...((tagOptions ?? []).length > 0 ? [{ key: 'tag', label: t('core.ui/tags.title'), type: 'select' as const, options: tagOptions }] : []),
    ...listing.filterDefs,
  ], [tagOptions, listing.filterDefs, t]);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((token) => { map[token.key] = token.values; });
    return map;
  }, [filterTokens]);

  const filteredRecords = useMemo(() => {
    const searchQ = (tokenMap['search']?.[0] ?? '').toLowerCase();
    const tagFilter = tokenMap['tag'] ?? [];
    return records.filter((record) => {
      if (searchQ && !listing.searchText(record).includes(searchQ)) return false;
      if (tagFilter.length > 0 && !tagFilter.some((tid) => record.tagIds?.includes(tid))) return false;
      return listing.matchesFilters(record, tokenMap);
    });
  }, [records, tokenMap, listing]);

  const getCardItems = useCallback(
    (record: EntityRecord): CustomFieldCardItem[] =>
      listing
        .cardItems(record)
        .filter((item) => item.key !== definition?.titleFieldKey && !listRowKeys.has(item.key)),
    [listing, definition, listRowKeys],
  );

  const subtitleField = useMemo(
    () => sortedFields.find((field) => field.key === definition?.subtitleFieldKey) ?? null,
    [sortedFields, definition],
  );

  const identity = useRecordIdentityText(definition, sortedFields, listing.displayValue);

  const getCardTitle = useCallback(
    (record: EntityRecord): string =>
      label(identity.titleOf(record) || resolveRecordTitle(record, definition?.titleFieldKey ?? '')),
    [identity, definition, label],
  );

  const getCardSubtitle = useCallback(
    (record: EntityRecord): string => identity.subtitleOf(record),
    [identity],
  );

  const getFieldText = useCallback(
    (record: EntityRecord, fieldKey: string): string => {
      const field = sortedFields.find((candidate) => candidate.key === fieldKey);
      if (!field) return '';
      const value = readValueByPath(record, field.key);
      if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return '';
      return listing.displayValue(record, field);
    },
    [sortedFields, listing],
  );

  const getCardImageUrl = useCallback(
    (record: EntityRecord): string | null =>
      resolveRecordImageUrl(record, sortedFields, definition?.imageFieldKey),
    [sortedFields, definition],
  );

  const openNewRecord = useCallback(
    () => openTab(parent
      ? buildChildNewTabKey(
          screenKey,
          parent.entityKey,
          parent.recordId,
          parent.fieldKey === definition?.parentFieldKey ? undefined : parent.fieldKey,
        )
      : buildNewTabKey(screenKey)),
    [openTab, screenKey, parent, definition],
  );
  const openRecord = useCallback(
    (record: EntityRecord) => openTab(buildViewTabKey(screenKey, record.id)),
    [openTab, screenKey],
  );

  const onClone = useCallback(
    (record: EntityRecord) => openTab(buildCloneTabKey(screenKey, record.id)),
    [openTab, screenKey],
  );

  /**
   * O que o registro é para o pai da aba em que aparece. É o que decide, por expressão declarada,
   * se a ação destrutiva do card apaga o registro ou apenas o desliga do pai — e um vínculo
   * obrigatório nunca se desliga (`parentLinkRelation`).
   */
  const relation: ActionRelation = !parent || !definition
    ? 'none'
    : parentLinkRelation(definition, parent.fieldKey, parentLinkField);

  const recordActions = useRecordActions();
  const { open: openRecordDialog } = useRecordDialog();

  /**
   * O que o kernel entrega a uma ação de registro. Estreito de propósito: o comando não enxerga
   * store nem repositório, só o registro e as operações que a tela sabe executar.
   */
  const buildActionHost = useCallback((record: EntityRecord): RecordActionHost => ({
    record,
    collection,
    screenKey,
    surface: parent ? 'parentTab' : 'list',
    parent: parent
      ? { fieldKey: parent.fieldKey, recordId: parent.recordId, required: !!parentLinkField?.required }
      : null,
    // O endereço do registro é o que a TELA declara (`recordTabPrefix`), e não a aba genérica: a
    // notícia se lê em `news-read:`, e era esse link que "copiar link" tinha de pôr na área de
    // transferência. O host da lista pode sobrepor (`recordTabKeys`) quando a extensão endereça
    // diferente do que a tela declara.
    recordTabKey: recordTabKeys?.(record.id).view ?? recordTabKeyOf(definition, screenKey, record.id),
    cloneTabKey: recordTabKeys?.(record.id).clone ?? buildCloneTabKey(screenKey, record.id),
    openTab,
    notify,
    patchRecord: (patch) => updateRecord(collection, record.id, patch),
    copyText: (text) => navigator.clipboard.writeText(text),
    openTagManager: () => setTagManagerRecord(record),
    requestDelete: () => setRecordToDelete(record),
    openDialog: (component) => openRecordDialog({ component, props: { record, collection, screenKey } }),
    t,
  }), [collection, screenKey, definition, parent, parentLinkField, openTab, notify, updateRecord, recordTabKeys, openRecordDialog, t]);

  const cardActionDefs = useMemo(
    () => getActionsByIds(definition?.cardActionIds ?? []),
    [getActionsByIds, definition],
  );

  const parameterPrompt = useActionParameterPrompt();

  const runCardAction = useCallback(async (
    action: ActionDefinition,
    record: EntityRecord,
    params?: Record<string, unknown>,
  ) => {
    setRunningActionId(action.id);
    try {
      // Ação que executa um COMANDO do sistema não vai ao servidor: é uma operação de tela, e roda
      // pelo mesmo host das ações embutidas.
      if (action.command) {
        const resolved = recordActions.find((candidate) => candidate.metadata.key === action.command);
        if (!resolved) {
          notify(t('action.missing-command', { title: action.title }), 'error');
          return;
        }
        await resolved.run(buildActionHost(record));
        return;
      }
      const response = await runAction({
        actionId: action.id,
        source: collection,
        context: record,
        recordId: record.id,
        isNew: false,
        params,
      });
      if (response.error || !response.outcome) {
        notify(response.error ? label(response.error, response.errorParams) : t('action.run-failed'), 'error');
        return;
      }
      const outcome = localizeActionOutcome(response.outcome, label);
      const { status } = outcome;
      if (status.message) notify(status.message, STATUS_TONE[status.code]);

      await dispatchActionOutcome(outcome, record as Record<string, CustomFieldValue>, {
        save: (override) => updateRecord(collection, record.id, override ?? record),
        clone: () => onClone(record),
        remove: () => setRecordToDelete(record),
        refresh: () => storeEvents.emit(StoreEvents.RECORDS_UPDATED),
      });
    } catch (error) {
      console.error('[useRecordListViewModel action]', error);
      notify(t('action.run-failed'), 'error');
    } finally {
      setRunningActionId(null);
    }
  }, [runAction, collection, notify, updateRecord, onClone, recordActions, buildActionHost, t, label]);

  /**
   * Pergunta os parâmetros, se a ação os declara, e dispara. Extraído porque agora DOIS caminhos
   * chegam aqui: o clique direto e a confirmação.
   */
  const askAndRunCardAction = useCallback((
    action: ActionDefinition,
    record: EntityRecord,
    exprContext: ActionExprContext,
  ) => {
    const asked = parameterPrompt.request(
      action,
      exprContext,
      (params) => void runCardAction(action, record, params),
    );
    if (!asked) void runCardAction(action, record);
  }, [parameterPrompt, runCardAction]);

  const cardExprContext = useCallback((record: EntityRecord): ActionExprContext => ({
    values: recordExpressionValues(sortedFields, record),
    record,
    isNew: false,
    isDirty: false,
    permissions: effectivePermissions,
    entity: collection,
    // Onde a ação está sendo desenhada, e o que o registro é para o pai da aba. É o que permite
    // uma extensão esconder a própria ação dentro da aba de outro registro.
    surface: (parent ? 'parentTab' : 'list') as ActionSurface,
    relation,
    user: viewer,
    references,
  }), [sortedFields, effectivePermissions, collection, parent, relation, viewer, references]);

  const confirmPendingCardAction = useCallback(() => {
    if (!pendingCardAction) return;
    const { action, record } = pendingCardAction;
    setPendingCardAction(null);
    askAndRunCardAction(action, record, cardExprContext(record));
  }, [pendingCardAction, askAndRunCardAction, cardExprContext]);

  const cancelPendingCardAction = useCallback(() => setPendingCardAction(null), []);

  const getCardActions = useCallback((record: EntityRecord): RecordCardAction[] => {
    const exprContext = cardExprContext(record);

    // As ações que a tela habilitou, resolvidas pelo SLOT e na ordem que ela configurou: `delete`
    // traz excluir e desvincular, e o `hiddenWhen` de cada uma decide qual o usuário vê. O kernel
    // não conhece nenhuma pelo nome.
    // O portão de admin cede à declaração da tela: onde a autoria é a posse (`authorCanDelete`),
    // quem escreveu enxerga a ação sobre o que escreveu. Espelha o `firestore.rules` — a UI não
    // oferece o que o servidor recusaria, nem esconde o que ele aceita.
    const isAuthorOfRecord = !!definition?.authorCanDelete && record.createdBy === viewer.id;
    const native = inScreenOrder(recordActions, definition?.listActions ?? [])
      .filter((action) => !action.metadata.requiresRecordPermission
        || can(`${collection}.${action.metadata.requiresRecordPermission}`)
        || isAuthorOfRecord)
      .filter((action) => !action.metadata.requiresTags || !!definition?.hasTags)
      .filter((action) => !isActionHidden(action.metadata.hiddenWhen, exprContext))
      .map<RecordCardAction>((action) => ({
        key: action.metadata.key,
        title: label(action.metadata.title),
        danger: action.metadata.danger,
        iconKey: action.metadata.icon,
        onClick: () => void action.run(buildActionHost(record)),
      }));
    const custom = cardActionDefs
      .filter((action) => !isActionHidden(action.hiddenWhen, exprContext))
      .map<RecordCardAction>((action) => ({
        key: action.id,
        title: label(action.title),
        danger: action.danger,
        iconKey: action.icon,
        disabled: runningActionId !== null || parameterPrompt.loading || isActionDisabled(action.disabledWhen, exprContext),
        active: actionActiveState(action.activeWhen, exprContext),
        // Confirmar vem ANTES de perguntar parâmetro: a pergunta "tem certeza?" é sobre o gesto, e
        // abrir um formulário para só depois perguntar se era para fazer inverte a ordem do diálogo.
        onClick: () => {
          if (action.confirmMessage?.trim()) {
            setPendingCardAction({ action, record });
            return;
          }
          askAndRunCardAction(action, record, exprContext);
        },
      }));

    return [...native, ...custom];
  }, [definition, collection, can, cardExprContext, recordActions, buildActionHost, cardActionDefs, viewer, runningActionId, parameterPrompt.loading, askAndRunCardAction, label]);

  const tagIdsOf = useCallback((entityId: string) => records.find((r) => r.id === entityId)?.tagIds ?? [], [records]);
  const setRecordTags = useCallback(
    (entityId: string, tagIds: string[]) => updateRecord(collection, entityId, { tagIds }),
    [updateRecord, collection],
  );
  const tagAdapter = useTagAdapter(collection, tagIdsOf, setRecordTags, definition?.tagCollection);

  const closeTagManager = useCallback(() => setTagManagerRecord(null), []);
  const cancelDelete = useCallback(() => setRecordToDelete(null), []);

  const confirmDelete = useCallback(async () => {
    if (!recordToDelete) return;
    setIsDeleting(true);
    try {
      await deleteRecord(collection, recordToDelete.id);
      notify(t('record.deleted'), 'success');
      setRecordToDelete(null);
    } catch {
      notify(t('record.delete-failed'), 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [recordToDelete, deleteRecord, collection, notify, t]);

  return {
    definition,
    collection,
    isAvailable,
    isLoading: definitionsLoading || recordsLoading,
    records,
    filteredRecords,
    filterTokens,
    filterDefs,
    savedFiltersScreenKey: savedFiltersKey,
    tags,
    setFilterTokens,
    canRead: can(collectionPermissionId(collection, 'read')),
    canCreate: can(collectionPermissionId(collection, 'create')),
    canUpdate: can(collectionPermissionId(collection, 'update')),
    canDeleteRecords: can(collectionPermissionId(collection, 'delete')),
    openNewRecord,
    openRecord,
    getCardItems,
    getCardTitle,
    getCardSubtitle,
    cardSubtitleIconKey: subtitleField?.listIcon ?? null,
    getFieldText,
    getCardImageUrl,
    getCardActions,
    parameterPrompt,
    pendingCardAction,
    confirmPendingCardAction,
    cancelPendingCardAction,
    tagAdapter,
    tagManagerRecord,
    closeTagManager,
    recordToDelete,
    cancelDelete,
    confirmDelete,
    isDeleting,
  };
};
