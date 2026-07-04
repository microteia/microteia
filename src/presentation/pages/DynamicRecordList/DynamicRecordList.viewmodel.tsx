import { useEffect, useMemo, useState, useCallback } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useCustomRecords } from '../../../stores/useCustomRecords';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useCustomFieldListing } from '../../hooks/useCustomFieldListing';
import type { CustomFieldCardItem } from '../../hooks/useCustomFieldListing';
import { parseDynamicTabKey, buildNewTabKey, buildViewTabKey } from '../../../shared/constants/dynamicScreenKeys';
import { sortFieldsByOrder } from '../../../domain/services/customFieldValues';
import type { CustomRecord, CustomRecordTag, ScreenDefinition } from '../../../domain/entities';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';

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
}

export const useDynamicRecordListViewModel = (tabKey: string): DynamicRecordListViewModel => {
  const { getDefinition, isLoading: definitionsLoading, tagsByScreen } = useScreenDefinitions();
  const { recordsByScreen, isLoading: recordsLoading } = useCustomRecords();
  const { openTab, setTabTitle } = useWorkspace();

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);

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
  };
};
