import { useMemo, useState, useCallback } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useCustomRecords } from '../../../stores/useCustomRecords';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useTenant } from '../../../stores/useTenant';
import { useNotification } from '../../../stores/useNotification';
import { useActions } from '../../../stores/useActions';
import { storeEvents, StoreEvents } from '../../../infrastructure/events/StoreEventEmitter';
import { isActionDisabled, isActionHidden } from '../../../domain/schema/actionExpression';
import { dispatchActionOutcome } from './useScreenActions';
import { useCustomFieldListing } from '../../hooks/useCustomFieldListing';
import type { CustomFieldCardItem } from '../../hooks/useCustomFieldListing';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
import { buildNewTabKey, buildViewTabKey, buildCloneTabKey, buildChildNewTabKey } from '../../../shared/constants/dynamicScreenKeys';
import { sortFieldsByOrder } from '../../../domain/services/customFieldValues';
import type { ActionDefinition, ActionStatusCode, CustomRecord, CustomRecordTag, ScreenDefinition, ScreenListAction } from '../../../domain/entities';
import type { TagStoreAdapter } from '../../components/ui/TagManager';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';

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
}

export interface RecordListViewModel {
  definition: ScreenDefinition | null;
  isAvailable: boolean;
  isLoading: boolean;
  records: CustomRecord[];
  filteredRecords: CustomRecord[];
  filterTokens: FilterToken[];
  filterDefs: FilterDef[];
  savedFiltersScreenKey: string;
  tags: CustomRecordTag[];
  setFilterTokens: (tokens: FilterToken[]) => void;
  openNewRecord: () => void;
  openRecord: (record: CustomRecord) => void;
  getCardItems: (record: CustomRecord) => CustomFieldCardItem[];
  getCardActions: (record: CustomRecord) => RecordCardAction[];
  tagAdapter: TagStoreAdapter;
  tagManagerRecord: CustomRecord | null;
  closeTagManager: () => void;
  recordToDelete: CustomRecord | null;
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
  const { screenKey, savedFiltersKey, parent } = source;
  const { getDefinition, isLoading: definitionsLoading, tagsByScreen, createTag, updateTag, deleteTag } = useScreenDefinitions();
  const { recordsByScreen, isLoading: recordsLoading, updateRecord, deleteRecord } = useCustomRecords();
  const { openTab } = useWorkspace();
  const { tenantRole } = useTenant();
  const { notify } = useNotification();
  const { getActionsByIds, runAction } = useActions();

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);
  const [tagManagerRecord, setTagManagerRecord] = useState<CustomRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<CustomRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [runningActionId, setRunningActionId] = useState<string | null>(null);

  const isAdmin = tenantRole === 'admin';
  const definition = useMemo(() => getDefinition(screenKey) ?? null, [getDefinition, screenKey]);
  const isAvailable = !!definition && !definition.builtin && definition.enabled;

  // Na aba do pai, todos os registros têm o mesmo vínculo: filtrar ou exibir esse campo não
  // informa nada. É o mesmo motivo pelo qual ele não vai ao formulário do filho.
  const sortedFields = useMemo(() => {
    if (!definition) return [];
    const fields = sortFieldsByOrder(definition.fields);
    return parent ? fields.filter((field) => field.key !== parent.fieldKey) : fields;
  }, [definition, parent]);

  const listing = useCustomFieldListing(screenKey, sortedFields);

  const records = useMemo(() => {
    const all = recordsByScreen[screenKey] ?? [];
    if (!parent) return all;
    return all.filter((record) => record.values[parent.fieldKey] === parent.recordId);
  }, [recordsByScreen, screenKey, parent]);

  const tags = useMemo(() => tagsByScreen[screenKey] ?? [], [tagsByScreen, screenKey]);

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
    return records.filter((record) => {
      if (searchQ) {
        const haystack = [
          record.title,
          ...Object.values(record.values).filter((v): v is string => typeof v === 'string'),
        ].join(' ').toLowerCase();
        if (!haystack.includes(searchQ)) return false;
      }
      if (tagFilter.length > 0 && !tagFilter.some((tid) => record.tagIds?.includes(tid))) return false;
      return listing.matchesFilters(record.values, tokenMap);
    });
  }, [records, tokenMap, listing]);

  const getCardItems = useCallback(
    (record: CustomRecord): CustomFieldCardItem[] =>
      listing.cardItems(record.values).filter((item) => item.key !== definition?.titleFieldKey),
    [listing, definition],
  );

  const openNewRecord = useCallback(
    () => openTab(parent
      ? buildChildNewTabKey(screenKey, parent.entityKey, parent.recordId)
      : buildNewTabKey(screenKey)),
    [openTab, screenKey, parent],
  );
  const openRecord = useCallback(
    (record: CustomRecord) => openTab(buildViewTabKey(screenKey, record.id)),
    [openTab, screenKey],
  );

  const onCopyLink = useCallback((record: CustomRecord) => {
    void navigator.clipboard.writeText(generateDeepLink(buildViewTabKey(screenKey, record.id)));
    notify('Link copiado para a área de transferência.', 'success');
  }, [screenKey, notify]);

  const onClone = useCallback(
    (record: CustomRecord) => openTab(buildCloneTabKey(screenKey, record.id)),
    [openTab, screenKey],
  );

  const cardActionDefs = useMemo(
    () => getActionsByIds(definition?.cardActionIds ?? []),
    [getActionsByIds, definition],
  );

  const runCardAction = useCallback(async (action: ActionDefinition, record: CustomRecord) => {
    setRunningActionId(action.id);
    try {
      const response = await runAction({
        actionId: action.id,
        source: screenKey,
        context: record.values,
        recordId: record.id,
        isNew: false,
      });
      if (response.error || !response.outcome) {
        notify(response.error ?? 'Não foi possível executar a ação.', 'error');
        return;
      }
      const { status } = response.outcome;
      if (status.message) notify(status.message, STATUS_TONE[status.code]);

      await dispatchActionOutcome(response.outcome, record.values, {
        save: (override) => updateRecord(record.id, screenKey, { values: override ?? record.values }),
        clone: () => onClone(record),
        remove: () => setRecordToDelete(record),
        refresh: () => storeEvents.emit(StoreEvents.CUSTOM_RECORDS_UPDATED),
      });
    } catch (error) {
      console.error('[useRecordListViewModel action]', error);
      notify('Não foi possível executar a ação.', 'error');
    } finally {
      setRunningActionId(null);
    }
  }, [runAction, screenKey, notify, updateRecord, onClone]);

  const getCardActions = useCallback((record: CustomRecord): RecordCardAction[] => {
    const handlers: Record<ScreenListAction, RecordCardAction> = {
      copyLink: { key: 'copyLink', title: 'Copiar link', onClick: () => onCopyLink(record) },
      clone: { key: 'clone', title: 'Duplicar', onClick: () => onClone(record) },
      manageTags: { key: 'manageTags', title: 'Gerenciar etiquetas', onClick: () => setTagManagerRecord(record) },
      delete: { key: 'delete', title: 'Excluir', danger: true, onClick: () => setRecordToDelete(record) },
    };
    const native = (definition?.listActions ?? [])
      .filter((action) => (action !== 'delete' || isAdmin) && (action !== 'manageTags' || !!definition?.hasTags))
      .map((action) => handlers[action]);

    const exprContext = {
      values: record.values,
      record: record.values,
      isNew: false,
      isDirty: false,
      role: tenantRole ?? '',
    };
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
  }, [definition, isAdmin, onCopyLink, onClone, cardActionDefs, tenantRole, runningActionId, runCardAction]);

  const tagAdapter = useMemo<TagStoreAdapter>(() => ({
    tags,
    getAppliedTags: (entityId: string) => {
      const record = records.find((r) => r.id === entityId);
      return tags.filter((t) => record?.tagIds?.includes(t.id));
    },
    setTags: (entityId: string, tagIds: string[]) => updateRecord(entityId, screenKey, { tagIds }),
    createTag: (name: string, color: string) => createTag(screenKey, name, color),
    updateTag: (id: string, data: { name: string; color: string }) => updateTag(screenKey, id, data),
    deleteTag: (id: string) => deleteTag(screenKey, id),
  }), [tags, records, updateRecord, screenKey, createTag, updateTag, deleteTag]);

  const closeTagManager = useCallback(() => setTagManagerRecord(null), []);
  const cancelDelete = useCallback(() => setRecordToDelete(null), []);

  const confirmDelete = useCallback(async () => {
    if (!recordToDelete) return;
    setIsDeleting(true);
    try {
      await deleteRecord(recordToDelete.id, screenKey);
      notify('Registro excluído com sucesso.', 'success');
      setRecordToDelete(null);
    } catch {
      notify('Erro ao excluir o registro.', 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [recordToDelete, deleteRecord, screenKey, notify]);

  return {
    definition,
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
