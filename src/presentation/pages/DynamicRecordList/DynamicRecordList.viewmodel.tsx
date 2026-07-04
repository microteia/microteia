import { useEffect, useMemo, useState, useCallback } from 'react';
import { useScreenDefinitions, fieldOptionsKey } from '../../../stores/useScreenDefinitions';
import { useCustomRecords } from '../../../stores/useCustomRecords';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useReferenceOptions } from '../../hooks/useReferenceOptions';
import { parseDynamicTabKey, buildNewTabKey, buildViewTabKey } from '../../../shared/constants/dynamicScreenKeys';
import { sortFieldsByOrder } from '../../../domain/services/customFieldValues';
import { formatCurrencyBRL } from '../../../utils/formatters';
import type { CustomRecord, FieldDefinition, ScreenDefinition } from '../../../domain/entities';
import type { FilterDef, FilterToken, FilterOption } from '../../components/ui/CompositeFilter';

const formatDateBR = (value: string): string => {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

export interface DynamicRecordListViewModel {
  definition: ScreenDefinition | null;
  isAvailable: boolean;
  isLoading: boolean;
  records: CustomRecord[];
  filteredRecords: CustomRecord[];
  listFields: FieldDefinition[];
  filterTokens: FilterToken[];
  filterDefs: FilterDef[];
  savedFiltersScreenKey: string;
  setFilterTokens: (tokens: FilterToken[]) => void;
  openNewRecord: () => void;
  openRecord: (record: CustomRecord) => void;
  displayValue: (record: CustomRecord, field: FieldDefinition) => string;
}

export const useDynamicRecordListViewModel = (tabKey: string): DynamicRecordListViewModel => {
  const { getDefinition, fieldOptionsByField, isLoading: definitionsLoading } = useScreenDefinitions();
  const { recordsByScreen, isLoading: recordsLoading } = useCustomRecords();
  const { openTab, setTabTitle } = useWorkspace();
  const referenceOptionsByEntity = useReferenceOptions();

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

  const listFields = useMemo(
    () => sortedFields.filter((f) => f.showInList && f.key !== definition?.titleFieldKey),
    [sortedFields, definition],
  );

  const records = useMemo(() => recordsByScreen[screenKey] ?? [], [recordsByScreen, screenKey]);

  const selectOptionLabels = useCallback((field: FieldDefinition): FilterOption[] => {
    const staticOptions = (field.options ?? []).map((o) => ({ value: o.key, label: o.label }));
    const dynamicOptions = (fieldOptionsByField[fieldOptionsKey(screenKey, field.key)] ?? [])
      .map((o) => ({ value: o.key, label: o.label }));
    return [...staticOptions, ...dynamicOptions];
  }, [fieldOptionsByField, screenKey]);

  const filterDefs = useMemo<FilterDef[]>(() => {
    const defs: FilterDef[] = [
      { key: 'search', label: 'Busca', type: 'text', placeholder: 'Buscar...' },
    ];
    sortedFields.filter((f) => f.filterable).forEach((field) => {
      switch (field.type) {
        case 'select': {
          const options = selectOptionLabels(field);
          if (options.length > 0) defs.push({ key: field.key, label: field.label, type: 'multiselect', options });
          break;
        }
        case 'reference': {
          const options = referenceOptionsByEntity[field.refEntity ?? ''] ?? [];
          if (options.length > 0) {
            defs.push({
              key: field.key,
              label: field.label,
              type: 'multiselect',
              options: options.map((o) => ({ value: o.value, label: o.label })),
            });
          }
          break;
        }
        case 'checkbox':
          defs.push({
            key: field.key,
            label: field.label,
            type: 'select',
            options: [{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }],
          });
          break;
        case 'date':
          defs.push({ key: field.key, label: field.label, type: 'date' });
          break;
        default:
          defs.push({ key: field.key, label: field.label, type: 'text', placeholder: field.label });
      }
    });
    return defs;
  }, [sortedFields, selectOptionLabels, referenceOptionsByEntity]);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((t) => { map[t.key] = t.values; });
    return map;
  }, [filterTokens]);

  const filteredRecords = useMemo(() => {
    const searchQ = (tokenMap['search']?.[0] ?? '').toLowerCase();
    const fieldByKey = new Map(sortedFields.map((f) => [f.key, f]));

    return records.filter((record) => {
      if (searchQ) {
        const haystack = [
          record.title,
          ...Object.values(record.values).filter((v): v is string => typeof v === 'string'),
        ].join(' ').toLowerCase();
        if (!haystack.includes(searchQ)) return false;
      }
      for (const [key, tokenValues] of Object.entries(tokenMap)) {
        if (key === 'search' || tokenValues.length === 0) continue;
        const field = fieldByKey.get(key);
        if (!field) continue;
        const value = record.values[key];
        switch (field.type) {
          case 'select':
          case 'reference':
            if (field.multi) {
              if (!Array.isArray(value) || !tokenValues.some((tv) => value.includes(tv))) return false;
            } else if (typeof value !== 'string' || !tokenValues.includes(value)) {
              return false;
            }
            break;
          case 'checkbox':
            if (String(value === true) !== tokenValues[0]) return false;
            break;
          case 'date':
            if (value !== tokenValues[0]) return false;
            break;
          default: {
            const query = tokenValues[0]?.toLowerCase() ?? '';
            const text = value == null ? '' : String(value).toLowerCase();
            if (query && !text.includes(query)) return false;
          }
        }
      }
      return true;
    });
  }, [records, tokenMap, sortedFields]);

  const displayValue = useCallback((record: CustomRecord, field: FieldDefinition): string => {
    const value = record.values[field.key];
    if (value == null || value === '') return '—';
    switch (field.type) {
      case 'date':
        return typeof value === 'string' ? formatDateBR(value) : '—';
      case 'currency':
        return typeof value === 'number' ? formatCurrencyBRL(value) : '—';
      case 'checkbox':
        return value === true ? 'Sim' : 'Não';
      case 'select': {
        const labels = new Map(selectOptionLabels(field).map((o) => [o.value, o.label]));
        if (Array.isArray(value)) return value.map((v) => labels.get(v) ?? v).join(', ') || '—';
        return typeof value === 'string' ? (labels.get(value) ?? value) : '—';
      }
      case 'reference': {
        const options = referenceOptionsByEntity[field.refEntity ?? ''] ?? [];
        const labels = new Map(options.map((o) => [o.value, o.label]));
        if (Array.isArray(value)) {
          const resolved = value.map((v) => labels.get(v)).filter(Boolean);
          return resolved.length > 0 ? resolved.join(', ') : '—';
        }
        return typeof value === 'string' ? (labels.get(value) ?? '—') : '—';
      }
      default:
        return String(value);
    }
  }, [selectOptionLabels, referenceOptionsByEntity]);

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
    listFields,
    filterTokens,
    filterDefs,
    savedFiltersScreenKey: tabKey,
    setFilterTokens,
    openNewRecord,
    openRecord,
    displayValue,
  };
};
