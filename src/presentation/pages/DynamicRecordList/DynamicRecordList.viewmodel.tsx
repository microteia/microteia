import { useEffect, useMemo, useState, useCallback } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useCustomRecords } from '../../../stores/useCustomRecords';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useTenant } from '../../../stores/useTenant';
import { useNotification } from '../../../stores/useNotification';
import { useCustomFieldListing } from '../../hooks/useCustomFieldListing';
import type { CustomFieldCardItem } from '../../hooks/useCustomFieldListing';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
import { parseDynamicTabKey, buildNewTabKey, buildViewTabKey, buildCloneTabKey } from '../../../shared/constants/dynamicScreenKeys';
import { sortFieldsByOrder } from '../../../domain/services/customFieldValues';
import type { CustomRecord, CustomRecordTag, ScreenDefinition, ScreenListAction } from '../../../domain/entities';
import type { TagStoreAdapter } from '../../components/ui/TagManager';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';

export interface DynamicCardAction {
  key: ScreenListAction;
  title: string;
  danger?: boolean;
  onClick: () => void;
}

export interface DynamicRecordListViewModel {
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
  getCardActions: (record: CustomRecord) => DynamicCardAction[];
  tagAdapter: TagStoreAdapter;
  tagManagerRecord: CustomRecord | null;
  closeTagManager: () => void;
  recordToDelete: CustomRecord | null;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  isDeleting: boolean;
}

export const useDynamicRecordListViewModel = (tabKey: string): DynamicRecordListViewModel => {
  const { getDefinition, isLoading: definitionsLoading, tagsByScreen, createTag, updateTag, deleteTag } = useScreenDefinitions();
  const { recordsByScreen, isLoading: recordsLoading, updateRecord, deleteRecord } = useCustomRecords();
  const { openTab, setTabTitle } = useWorkspace();
  const { tenantRole } = useTenant();
  const { notify } = useNotification();

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);
  const [tagManagerRecord, setTagManagerRecord] = useState<CustomRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<CustomRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = tenantRole === 'admin';
  const screenKey = useMemo(() => parseDynamicTabKey(tabKey)?.screenKey ?? '', [tabKey]);
  const definition = useMemo(() => getDefinition(screenKey) ?? null, [getDefinition, screenKey]);
  const isAvailable = !!definition && !definition.builtin && definition.enabled;

  useEffect(() => {
    if (definition) setTabTitle(tabKey, definition.titlePlural);
  }, [definition, tabKey, setTabTitle]);

  const sortedFields = useMemo(
    () => (definition ? sortFieldsByOrder(definition.fields) : []),
    [definition],
  );

  const listing = useCustomFieldListing(screenKey, sortedFields);

  const records = useMemo(() => recordsByScreen[screenKey] ?? [], [recordsByScreen, screenKey]);

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

  const openNewRecord = useCallback(() => openTab(buildNewTabKey(screenKey)), [openTab, screenKey]);
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

  const getCardActions = useCallback((record: CustomRecord): DynamicCardAction[] => {
    const handlers: Record<ScreenListAction, DynamicCardAction> = {
      copyLink: { key: 'copyLink', title: 'Copiar link', onClick: () => onCopyLink(record) },
      clone: { key: 'clone', title: 'Duplicar', onClick: () => onClone(record) },
      manageTags: { key: 'manageTags', title: 'Gerenciar etiquetas', onClick: () => setTagManagerRecord(record) },
      delete: { key: 'delete', title: 'Excluir', danger: true, onClick: () => setRecordToDelete(record) },
    };
    return (definition?.listActions ?? [])
      .filter((action) => (action !== 'delete' || isAdmin) && (action !== 'manageTags' || !!definition?.hasTags))
      .map((action) => handlers[action]);
  }, [definition, isAdmin, onCopyLink, onClone]);

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
    savedFiltersScreenKey: tabKey,
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
