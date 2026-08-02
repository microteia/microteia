import { useMemo, useState, useCallback, useEffect } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useRecords } from '../../../stores/useRecords';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useTenant } from '../../../stores/useTenant';
import { useNotification } from '../../../stores/useNotification';
import { useActions } from '../../../stores/useActions';
import { storeEvents, StoreEvents } from '../../../infrastructure/events/StoreEventEmitter';
import { isActionDisabled, isActionHidden } from '../../../domain/schema/actionExpression';
import type { ActionRelation, ActionSurface } from '../../../domain/schema/actionExpression';
import { dispatchActionOutcome } from './useScreenActions';
import { useCustomFieldListing } from '../../hooks/useCustomFieldListing';
import type { CustomFieldCardItem } from '../../hooks/useCustomFieldListing';
import { buildNewTabKey, buildViewTabKey, buildCloneTabKey, buildChildNewTabKey } from '../../../shared/constants/dynamicScreenKeys';
import { resolveRecordTitle, sortFieldsByOrder } from '../../../domain/services/customFieldValues';
import { isBoundScreen, isOwnedByParentScreen, screenDataCollection } from '../../../domain/services/screenDataCollection';
import { useEntityFormFields } from '../useEntityFormFields';
import { useSchemaContext } from '../useSchemaContext';
import { useRecordActions } from '../recordActions/useRecordActions';
import type { RecordActionHost } from '../recordActions/recordActionHost';
import { deriveListRows } from '../deriveEntitySchema';
import { consumeNavigationIntent, subscribeNavigationIntent } from '../../../infrastructure/navigation/navigationIntent';
import type { ActionDefinition, ActionStatusCode, CustomFieldValue, EntityRecord, ScreenDefinition, Tag } from '../../../domain/entities';
import type { TagStoreAdapter } from '../../components/ui/TagManager';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';
import { useTagAdapter, useTagCollection } from './useTagAdapter';
import { useTags } from '../../../stores/useTags';

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
  /** Ordem em que a listagem apresenta os registros. Ver `EntityListOptions.sortRecords`. */
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
  openNewRecord: () => void;
  openRecord: (record: EntityRecord) => void;
  getCardItems: (record: EntityRecord) => CustomFieldCardItem[];
  getCardTitle: (record: EntityRecord) => string;
  /** Texto do campo declarado como subtítulo (`subtitleFieldKey`), já resolvido para rótulo. */
  getCardSubtitle: (record: EntityRecord) => string;
  /** Ícone da linha de subtítulo do card, quando o campo declara um. */
  cardSubtitleIconKey: string | null;
  getCardActions: (record: EntityRecord) => RecordCardAction[];
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
  const { tenantRole } = useTenant();
  const { notify } = useNotification();
  const { getActionsByIds, runAction } = useActions();

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
  const [isDeleting, setIsDeleting] = useState(false);
  const [runningActionId, setRunningActionId] = useState<string | null>(null);

  useEffect(
    () => (screenKey
      ? subscribeNavigationIntent(screenKey, (tokens) => setFilterTokens(tokens as FilterToken[]))
      : undefined),
    [screenKey],
  );

  const isAdmin = tenantRole === 'admin';
  const definition = useMemo(() => getDefinition(screenKey) ?? null, [getDefinition, screenKey]);
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
  const sortedFields = useMemo(() => {
    if (!definition) return [];
    const fields = isBound ? boundFields.fields : sortFieldsByOrder(definition.fields);
    return parent ? fields.filter((field) => field.key !== parent.fieldKey) : fields;
  }, [definition, isBound, boundFields.fields, parent]);

  // Campo que já é meta-linha do card (tem ícone de listagem declarado) não se repete no bloco de
  // campos adicionais — seria a mesma informação duas vezes no cartão.
  const listRowKeys = useMemo(
    () => new Set(deriveListRows(schemaContext, collection).map((row) => row.key)),
    [schemaContext, collection],
  );

  const listing = useCustomFieldListing(sortedFields);

  const records = useMemo(() => {
    const all = recordsByCollection[collection] ?? [];
    if (!parent) return all;
    return all.filter((record) => record[parent.fieldKey] === parent.recordId);
  }, [recordsByCollection, collection, parent]);


  const tagCollection = useTagCollection(collection, definition?.tagCollection);
  const tags = useTags().getTags(tagCollection);

  const tagOptions = useMemo<FilterDef['options']>(() =>
    tags.map((t) => ({ value: t.id, label: t.name, color: t.color })),
    [tags],
  );

  const filterDefs = useMemo<FilterDef[]>(() => [
    { key: 'search', label: 'Busca', type: 'text', placeholder: 'Buscar...' },
    ...((tagOptions ?? []).length > 0 ? [{ key: 'tag', label: 'Etiqueta', type: 'select' as const, options: tagOptions }] : []),
    ...listing.filterDefs,
  ], [tagOptions, listing.filterDefs]);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((t) => { map[t.key] = t.values; });
    return map;
  }, [filterTokens]);

  const filteredRecords = useMemo(() => {
    const searchQ = (tokenMap['search']?.[0] ?? '').toLowerCase();
    const tagFilter = tokenMap['tag'] ?? [];
    const matched = records.filter((record) => {
      if (searchQ) {
        const haystack = Object.values(record)
          .filter((v): v is string => typeof v === 'string')
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(searchQ)) return false;
      }
      if (tagFilter.length > 0 && !tagFilter.some((tid) => record.tagIds?.includes(tid))) return false;
      return listing.matchesFilters(record, tokenMap);
    });
    // Sem ordem declarada vale a da coleção (mais recente primeiro). A tela cuja leitura DEPENDE da
    // ordem — uma agenda de prazos se lê do mais próximo ao mais distante — informa a sua.
    return sortRecords ? [...matched].sort(sortRecords) : matched;
  }, [records, tokenMap, listing, sortRecords]);

  const getCardItems = useCallback(
    (record: EntityRecord): CustomFieldCardItem[] =>
      listing
        .cardItems(record)
        .filter((item) => item.key !== definition?.titleFieldKey && !listRowKeys.has(item.key)),
    [listing, definition, listRowKeys],
  );

  const getCardTitle = useCallback(
    (record: EntityRecord): string => {
      const titleField = definition?.fields.find((field) => field.key === definition.titleFieldKey);
      if (titleField && (titleField.type === 'reference' || titleField.type === 'select')) {
        const resolved = listing.displayValue(record, titleField);
        if (resolved && resolved !== '—') return resolved;
      }
      return resolveRecordTitle(record, definition?.titleFieldKey ?? '');
    },
    [definition, listing],
  );

  const subtitleField = useMemo(
    () => sortedFields.find((field) => field.key === definition?.subtitleFieldKey) ?? null,
    [sortedFields, definition],
  );

  const getCardSubtitle = useCallback(
    (record: EntityRecord): string => {
      if (!subtitleField) return '';
      const value = listing.displayValue(record, subtitleField);
      return value === '—' ? '' : value;
    },
    [subtitleField, listing],
  );

  const openNewRecord = useCallback(
    () => openTab(parent
      ? buildChildNewTabKey(screenKey, parent.entityKey, parent.recordId)
      : buildNewTabKey(screenKey)),
    [openTab, screenKey, parent],
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
   * se a ação destrutiva do card apaga o registro ou apenas o desliga do pai.
   */
  const relation: ActionRelation = !parent || !definition
    ? 'none'
    : isOwnedByParentScreen(definition) ? 'owned' : 'related';

  const recordActions = useRecordActions();

  /**
   * O que o kernel entrega a uma ação de registro. Estreito de propósito: o comando não enxerga
   * store nem repositório, só o registro e as operações que a tela sabe executar.
   */
  const buildActionHost = useCallback((record: EntityRecord): RecordActionHost => ({
    record,
    collection,
    screenKey,
    surface: parent ? 'parentTab' : 'list',
    parent: parent ? { fieldKey: parent.fieldKey, recordId: parent.recordId } : null,
    recordTabKey: recordTabKeys?.(record.id).view ?? buildViewTabKey(screenKey, record.id),
    cloneTabKey: recordTabKeys?.(record.id).clone ?? buildCloneTabKey(screenKey, record.id),
    openTab,
    notify,
    patchRecord: (patch) => updateRecord(collection, record.id, patch),
    copyText: (text) => navigator.clipboard.writeText(text),
    openTagManager: () => setTagManagerRecord(record),
    requestDelete: () => setRecordToDelete(record),
  }), [collection, screenKey, parent, openTab, notify, updateRecord, recordTabKeys]);

  const cardActionDefs = useMemo(
    () => getActionsByIds(definition?.cardActionIds ?? []),
    [getActionsByIds, definition],
  );

  const runCardAction = useCallback(async (action: ActionDefinition, record: EntityRecord) => {
    setRunningActionId(action.id);
    try {
      // Ação que executa um COMANDO do sistema não vai ao servidor: é uma operação de tela, e roda
      // pelo mesmo host das ações embutidas.
      if (action.command) {
        const resolved = recordActions.find((candidate) => candidate.metadata.key === action.command);
        if (!resolved) {
          notify(`A ação "${action.title}" aponta para um comando que não existe.`, 'error');
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
      });
      if (response.error || !response.outcome) {
        notify(response.error ?? 'Não foi possível executar a ação.', 'error');
        return;
      }
      const { status } = response.outcome;
      if (status.message) notify(status.message, STATUS_TONE[status.code]);

      await dispatchActionOutcome(response.outcome, record as Record<string, CustomFieldValue>, {
        save: (override) => updateRecord(collection, record.id, override ?? record),
        clone: () => onClone(record),
        remove: () => setRecordToDelete(record),
        refresh: () => storeEvents.emit(StoreEvents.RECORDS_UPDATED),
      });
    } catch (error) {
      console.error('[useRecordListViewModel action]', error);
      notify('Não foi possível executar a ação.', 'error');
    } finally {
      setRunningActionId(null);
    }
  }, [runAction, collection, notify, updateRecord, onClone, recordActions, buildActionHost]);

  const getCardActions = useCallback((record: EntityRecord): RecordCardAction[] => {
    const exprContext = {
      values: record,
      record,
      isNew: false,
      isDirty: false,
      role: tenantRole ?? '',
      // Onde a ação está sendo desenhada, e o que o registro é para o pai da aba. É o que permite
      // uma extensão esconder a própria ação dentro da aba de outro registro.
      surface: (parent ? 'parentTab' : 'list') as ActionSurface,
      relation,
    };

    // As ações que a tela habilitou, resolvidas pelo SLOT: `delete` traz excluir e desvincular, e
    // o `hiddenWhen` de cada uma decide qual o usuário vê. O kernel não conhece nenhuma pelo nome.
    const enabledSlots = new Set<string>(definition?.listActions ?? []);
    const native = recordActions
      .filter((action) => enabledSlots.has(action.slot))
      .filter((action) => !action.metadata.requiresTenantAdmin || isAdmin)
      .filter((action) => !action.metadata.requiresTags || !!definition?.hasTags)
      .filter((action) => !isActionHidden(action.metadata.hiddenWhen, exprContext))
      .map<RecordCardAction>((action) => ({
        key: action.metadata.key,
        title: action.metadata.title,
        danger: action.metadata.danger,
        iconKey: action.metadata.icon,
        onClick: () => void action.run(buildActionHost(record)),
      }));
    const custom = cardActionDefs
      .filter((action) => !isActionHidden(action.hiddenWhen, exprContext))
      .map<RecordCardAction>((action) => ({
        key: action.id,
        title: action.title,
        danger: action.danger,
        iconKey: action.icon,
        disabled: runningActionId !== null || isActionDisabled(action.disabledWhen, exprContext),
        onClick: () => void runCardAction(action, record),
      }));

    return [...native, ...custom];
  }, [definition, isAdmin, parent, relation, recordActions, buildActionHost, cardActionDefs, tenantRole, runningActionId, runCardAction]);

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
      notify('Registro excluído com sucesso.', 'success');
      setRecordToDelete(null);
    } catch {
      notify('Erro ao excluir o registro.', 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [recordToDelete, deleteRecord, collection, notify]);

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
    openNewRecord,
    openRecord,
    getCardItems,
    getCardTitle,
    getCardSubtitle,
    cardSubtitleIconKey: subtitleField?.listIcon ?? null,
    getCardActions,
    tagAdapter,
    tagManagerRecord,
    closeTagManager,
    recordToDelete,
    cancelDelete,
    confirmDelete,
    isDeleting,
  };
};
