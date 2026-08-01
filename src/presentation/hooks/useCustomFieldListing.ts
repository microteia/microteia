import { useCallback, useMemo } from 'react';
import { useTheme } from 'styled-components';
import { useLookups } from '../../stores/useLookups';
import { useReferenceOptions } from './useReferenceOptions';
import { formatCurrencyBRL } from '../../utils/formatters';
import { readValueByPath, toDateFieldInput } from '../../domain/services/customFieldValues';
import { resolveColor, resolveFieldOptionColor } from '../../shared/styles/colorUtils';
import type { CustomFieldValue, FieldDefinition } from '../../domain/entities';
import type { FilterDef, FilterOption } from '../components/ui/CompositeFilter';

export const CUSTOM_FIELD_FILTER_PREFIX = 'cf-';

/**
 * O REGISTRO inteiro: filtrar e exibir é ler pela chave do campo. É `object` (e não
 * `Record<string, unknown>`) para aceitar as entidades tipadas sem cast.
 */
export type RecordValues = object;

/**
 * A chave do campo é um CAMINHO: um campo dentro de um objeto declarado chega como `address.city`.
 * Ler pela raiz devolvia `undefined` — o campo não aparecia no cartão e o filtro por ele não casava
 * registro nenhum, sem erro à vista.
 */
const fieldValue = (values: RecordValues | undefined, field: FieldDefinition): CustomFieldValue =>
  readValueByPath(values ?? {}, field.key) as CustomFieldValue;

export interface CustomFieldBadgeItem {
  label: string;
  color?: string;
}

export interface CustomFieldCardItem {
  key: string;
  label?: string;
  value: string;
  badges?: CustomFieldBadgeItem[];
  type: 'text' | 'markdown';
}

export interface CustomFieldListing {
  listFields: FieldDefinition[];
  filterDefs: FilterDef[];
  matchesFilters: (values: RecordValues | undefined, tokenMap: Record<string, string[]>) => boolean;
  displayValue: (values: RecordValues | undefined, field: FieldDefinition) => string;
  cardItems: (values: RecordValues | undefined) => CustomFieldCardItem[];
}

const formatDateBR = (value: unknown): string => {
  const iso = toDateFieldInput(value);
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
};

export const useCustomFieldListing = (
  fields: FieldDefinition[],
  filterKeyPrefix = '',
): CustomFieldListing => {
  const { getOptions } = useLookups();
  const referenceOptionsByEntity = useReferenceOptions();
  const theme = useTheme();

  const listFields = useMemo(() => fields.filter((f) => f.showInList), [fields]);
  const filterableFields = useMemo(() => fields.filter((f) => f.filterable), [fields]);

  const selectOptionLabels = useCallback((field: FieldDefinition): FilterOption[] => {
    const staticOptions = (field.options ?? []).map((o) => ({
      value: o.key,
      label: o.label,
      color: resolveFieldOptionColor(o.color, field.optionsColored, theme),
    }));
    const dynamicOptions = getOptions(field.lookupCollection ?? '').map((option) => ({
      value: option.label,
      label: option.label,
      color: resolveColor(option.color, theme, false),
    }));
    return [...staticOptions, ...dynamicOptions];
  }, [getOptions, theme]);

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

  const matchesFilters = useCallback((values: RecordValues | undefined, tokenMap: Record<string, string[]>): boolean => {
    for (const field of filterableFields) {
      const tokenValues = tokenMap[`${filterKeyPrefix}${field.key}`] ?? [];
      if (tokenValues.length === 0) continue;
      const value = fieldValue(values, field);
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
          if (toDateFieldInput(value) !== tokenValues[0]) return false;
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

  const displayValue = useCallback((values: RecordValues | undefined, field: FieldDefinition): string => {
    const value = fieldValue(values, field);
    if (value == null || value === '') return '—';
    switch (field.type) {
      case 'date':
        return formatDateBR(value) || '—';
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

  const selectBadges = useCallback((values: RecordValues | undefined, field: FieldDefinition): CustomFieldBadgeItem[] => {
    const value = fieldValue(values, field);
    const selectedKeys = Array.isArray(value) ? value : (typeof value === 'string' && value ? [value] : []);
    const options = new Map(selectOptionLabels(field).map((o) => [o.value, o]));
    return selectedKeys.map((key) => {
      const option = options.get(key);
      return { label: option?.label ?? key, color: option?.color };
    });
  }, [selectOptionLabels]);

  const cardItems = useCallback((values: RecordValues | undefined): CustomFieldCardItem[] =>
    listFields.map((field) => ({
      key: field.key,
      label: field.listLabel || undefined,
      value: displayValue(values, field),
      badges: field.type === 'select' && field.optionsColored ? selectBadges(values, field) : undefined,
      type: field.type === 'markdown' ? 'markdown' : 'text',
    })),
    [listFields, displayValue, selectBadges],
  );

  return useMemo(() => ({
    listFields,
    filterDefs,
    matchesFilters,
    displayValue,
    cardItems,
  }), [listFields, filterDefs, matchesFilters, displayValue, cardItems]);
};
