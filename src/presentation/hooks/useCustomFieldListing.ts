import { useCallback, useMemo } from 'react';
import { useScreenDefinitions, fieldOptionsKey } from '../../stores/useScreenDefinitions';
import { useReferenceOptions } from './useReferenceOptions';
import { formatCurrencyBRL } from '../../utils/formatters';
import type { CustomFieldValue, FieldDefinition } from '../../domain/entities';
import type { FilterDef, FilterOption } from '../components/ui/CompositeFilter';

export const CUSTOM_FIELD_FILTER_PREFIX = 'cf-';

export type CustomValuesMap = Record<string, CustomFieldValue>;

export interface CustomFieldCardItem {
  key: string;
  label: string;
  value: string;
}

export interface CustomFieldListing {
  listFields: FieldDefinition[];
  filterDefs: FilterDef[];
  matchesFilters: (values: CustomValuesMap | undefined, tokenMap: Record<string, string[]>) => boolean;
  displayValue: (values: CustomValuesMap | undefined, field: FieldDefinition) => string;
  cardItems: (values: CustomValuesMap | undefined) => CustomFieldCardItem[];
}

const formatDateBR = (value: string): string => {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

export const useCustomFieldListing = (
  screenKey: string,
  fields: FieldDefinition[],
  filterKeyPrefix = '',
): CustomFieldListing => {
  const { fieldOptionsByField } = useScreenDefinitions();
  const referenceOptionsByEntity = useReferenceOptions();

  const listFields = useMemo(() => fields.filter((f) => f.showInList), [fields]);
  const filterableFields = useMemo(() => fields.filter((f) => f.filterable), [fields]);

  const selectOptionLabels = useCallback((field: FieldDefinition): FilterOption[] => {
    const staticOptions = (field.options ?? []).map((o) => ({ value: o.key, label: o.label }));
    const dynamicOptions = (fieldOptionsByField[fieldOptionsKey(screenKey, field.key)] ?? [])
      .map((o) => ({ value: o.key, label: o.label }));
    return [...staticOptions, ...dynamicOptions];
  }, [fieldOptionsByField, screenKey]);

  const filterDefs = useMemo<FilterDef[]>(() => {
    const defs: FilterDef[] = [];
    filterableFields.forEach((field) => {
      const key = `${filterKeyPrefix}${field.key}`;
      switch (field.type) {
        case 'select': {
          const options = selectOptionLabels(field);
          if (options.length > 0) defs.push({ key, label: field.label, type: 'multiselect', options });
          break;
        }
        case 'reference': {
          const options = referenceOptionsByEntity[field.refEntity ?? ''] ?? [];
          if (options.length > 0) {
            defs.push({
              key,
              label: field.label,
              type: 'multiselect',
              options: options.map((o) => ({ value: o.value, label: o.label })),
            });
          }
          break;
        }
        case 'checkbox':
          defs.push({
            key,
            label: field.label,
            type: 'select',
            options: [{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }],
          });
          break;
        case 'date':
          defs.push({ key, label: field.label, type: 'date' });
          break;
        default:
          defs.push({ key, label: field.label, type: 'text', placeholder: field.label });
      }
    });
    return defs;
  }, [filterableFields, filterKeyPrefix, selectOptionLabels, referenceOptionsByEntity]);

  const matchesFilters = useCallback((values: CustomValuesMap | undefined, tokenMap: Record<string, string[]>): boolean => {
    for (const field of filterableFields) {
      const tokenValues = tokenMap[`${filterKeyPrefix}${field.key}`] ?? [];
      if (tokenValues.length === 0) continue;
      const value = values?.[field.key];
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
  }, [filterableFields, filterKeyPrefix]);

  const displayValue = useCallback((values: CustomValuesMap | undefined, field: FieldDefinition): string => {
    const value = values?.[field.key];
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

  const cardItems = useCallback((values: CustomValuesMap | undefined): CustomFieldCardItem[] =>
    listFields.map((field) => ({ key: field.key, label: field.label, value: displayValue(values, field) })),
    [listFields, displayValue],
  );

  return useMemo(() => ({
    listFields,
    filterDefs,
    matchesFilters,
    displayValue,
    cardItems,
  }), [listFields, filterDefs, matchesFilters, displayValue, cardItems]);
};
