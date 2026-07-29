import { useMemo, useState, useCallback } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useRecords } from '../../../stores/useRecords';
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
import { resolveRecordTitle, sortFieldsByOrder } from '../../../domain/services/customFieldValues';
import type { ActionDefinition, ActionStatusCode, CustomFieldValue, EntityRecord, ScreenTag, ScreenDefinition, ScreenListAction } from '../../../domain/entities';
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
  records: EntityRecord[];
  filteredRecords: EntityRecord[];
  filterTokens: FilterToken[];
  filterDefs: FilterDef[];
  savedFiltersScreenKey: string;
  tags: ScreenTag[];
  setFilterTokens: (tokens: FilterToken[]) => void;
  openNewRecord: () => void;
  openRecord: (record: EntityRecord) => void;
  getCardItems: (record: EntityRecord) => CustomFieldCardItem[];
  getCardTitle: (record: EntityRecord) => string;
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
  const { screenKey, savedFiltersKey, parent } = source;
  const { getDefinition, isLoading: definitionsLoading, tagsByScreen, createTag, updateTag, deleteTag } = useScreenDefinitions();
  const { recordsByCollection, isLoading: recordsLoading, updateRecord, deleteRecord } = useRecords();
  const { openTab } = useWorkspace();
  const { tenantRole } = useTenant();
  const { notify } = useNotification();
  const { getActionsByIds, runAction } = useActions();

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);
  const [tagManagerRecord, setTagManagerRecord] = useState<EntityRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<EntityRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [runningActionId, setRunningActionId] = useState<string | null>(null);

  const isAdmin = tenantRole === 'admin';
  const definition = useMemo(() => getDefinition(screenKey) ?? null, [getDefinition, screenKey]);
  const isAvailable = !!definition && definition.origin !== 'builtin' && definition.enabled;

  // Na aba do pai, todos os registros têm o mesmo vínculo: filtrar ou exibir esse campo não
  // informa nada. É o mesmo motivo pelo qual ele não vai ao formulário do filho.
  const sortedFields = useMemo(() => {
    if (!definition) return [];
    const fields = sortFieldsByOrder(definition.fields);
    return parent ? fields.filter((field) => field.key !== parent.fieldKey) : fields;
  }, [definition, parent]);

  const listing = useCustomFieldListing(screenKey, sortedFields);

  const records = useMemo(() => {
    const all = recordsByCollection[screenKey] ?? [];
    if (!parent) return all;
    return all.filter((record) => record[parent.fieldKey] === parent.recordId);
  }, [recordsByCollection, screenKey, parent]);

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
        const haystack = Object.values(record)
          .filter((v): v is string => typeof v === 'string')
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(searchQ)) return false;
      }
      if (tagFilter.length > 0 && !tagFilter.some((tid) => record.tagIds?.includes(tid))) return false;
      return listing.matchesFilters(record, tokenMap);
    });
  }, [records, tokenMap, listing]);

  const getCardItems = useCallback(
    (record: EntityRecord): CustomFieldCardItem[] =>
      listing.cardItems(record).filter((item) => item.key !== definition?.titleFieldKey),
    [listing, definition],
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

  const onCopyLink = useCallback((record: EntityRecord) => {
    void navigator.clipboard.writeText(generateDeepLink(buildViewTabKey(screenKey, record.id)));
    notify('Link copiado para a área de transferência.', 'success');
  }, [screenKey, notify]);

  const onClone = useCallback(
    (record: EntityRecord) => openTab(buildCloneTabKey(screenKey, record.id)),
    [openTab, screenKey],
  );

  const cardActionDefs = useMemo(
    () => getActionsByIds(definition?.cardActionIds ?? []),
    [getActionsByIds, definition],
  );

  const runCardAction = useCallback(async (action: ActionDefinition, record: EntityRecord) => {
    setRunningActionId(action.id);
    try {
      const response = await runAction({
        actionId: action.id,
        source: screenKey,
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
        save: (override) => updateRecord(screenKey, record.id, override ?? record),
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
  }, [runAction, screenKey, notify, updateRecord, onClone]);

  const getCardActions = useCallback((record: EntityRecord): RecordCardAction[] => {
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
      values: record,
      record,
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
    setTags: (entityId: string, tagIds: string[]) => updateRecord(screenKey, entityId, { tagIds }),
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
      await deleteRecord(screenKey, recordToDelete.id);
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
    getCardTitle,
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
