import { useCallback, useMemo } from 'react';
import { useTheme } from 'styled-components';
import { useLookups } from '../../stores/useLookups';
import { useReferenceOptions } from './useReferenceOptions';
import { formatCurrencyBRL } from '../../utils/formatters';
import {
  FILTER_EMPTY_KEY, FILTER_FILLED_KEY, FILTER_RANGE_TO_SUFFIX, fileNameFromUrl, isEmptyFieldValue, isPresenceFilterable,
  readValueByPath, toDateFieldInput,
} from '../../domain/services/customFieldValues';
import { resolveColor, resolveFieldOptionColor } from '../../shared/styles/colorUtils';
import type { CustomFieldValue, FieldDefinition } from '../../domain/entities';
import type { FilterDef, FilterOption } from '../components/ui/CompositeFilter';

import { useT } from '../shared/i18n/useT';
export const CUSTOM_FIELD_FILTER_PREFIX = 'cf-';

export { FILTER_EMPTY_KEY, FILTER_FILLED_KEY, FILTER_RANGE_TO_SUFFIX };

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
  /**
   * QUALQUER campo como item de cartão, no formato de `cardItems`. `badges: true` desenha as opções
   * escolhidas como etiquetas mesmo num campo sem `optionsColored` — é o pedido explícito de quem
   * declara o cartão (`variant: 'badge'`).
   */
  fieldItem: (values: RecordValues | undefined, field: FieldDefinition, options?: { badges?: boolean }) => CustomFieldCardItem;
  /** A cor da primeira opção escolhida num campo de seleção; nada escolhido ou sem cor = `undefined`. */
  optionColor: (values: RecordValues | undefined, field: FieldDefinition) => string | undefined;
  /** Texto varrido pela busca livre — sem as URLs dos campos de arquivo. */
  searchText: (values: RecordValues | undefined) => string;
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
  const t = useT('core.records');
  const { getOptions } = useLookups();
  const referenceOptionsByEntity = useReferenceOptions();
  const theme = useTheme();

  const listFields = useMemo(() => fields.filter((f) => f.showInList), [fields]);
  // Campo `file` NÃO filtra, e a exclusão é aqui e não no `switch`: o `default` de `filterDefs` cai
  // em `type: 'text'`, então um campo de arquivo viraria — em silêncio — um filtro de texto sobre
  // URLs de download, que ninguém digita. Excluído na origem, `filterDefs` e `matchesFilters` já
  // nascem certos, porque os dois iteram esta lista.
  const filterableFields = useMemo(
    () => fields.filter((f) => f.filterable && f.type !== 'file'),
    [fields],
  );
  const presenceFields = useMemo(() => filterableFields.filter(isPresenceFilterable), [filterableFields]);

  /**
   * O texto do registro que a BUSCA livre varre. A junção crua de todos os valores string incluía a
   * URL de download de um arquivo, e com ela o token e o `alt=media` — bastava digitar "png" para
   * casar todo registro que tivesse imagem.
   */
  const fileFieldKeys = useMemo(
    () => new Set(fields.filter((f) => f.type === 'file').map((f) => f.key)),
    [fields],
  );

  const searchText = useCallback((values: RecordValues | undefined): string => {
    if (!values) return '';
    return Object.entries(values)
      .filter(([key, value]) => typeof value === 'string' && !fileFieldKeys.has(key))
      .map(([, value]) => value as string)
      .join(' ')
      .toLowerCase();
  }, [fileFieldKeys]);

  /**
   * O valor de uma opção é a CHAVE, tanto na lista declarada no campo quanto na lista de opções —
   * é o que está gravado no registro. Enquanto a lista devolvia o rótulo como valor, a lista cuja
   * chave difere do rótulo não filtrava nada (o registro guarda `pending`, o filtro procurava
   * `Pendente`) e o chip do filtro exibia a chave crua. Nas opções cadastradas no escritório chave e
   * rótulo são o mesmo texto, e por isso nada muda para elas.
   */
  const selectOptionLabels = useCallback((field: FieldDefinition): FilterOption[] => {
    const staticOptions = (field.options ?? []).map((o) => ({
      value: o.key,
      label: o.label,
      color: resolveFieldOptionColor(o.color, field.optionsColored, theme),
    }));
    const dynamicOptions = getOptions(field.lookupCollection ?? '')
      .filter((option) => !staticOptions.some((existing) => existing.value === option.key))
      .map((option) => ({
        value: option.key,
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
            options: [
              { value: 'true', label: t('core.ui/answer.yes') },
              { value: 'false', label: t('core.ui/answer.no') },
            ],
          });
          break;
        case 'date':
          defs.push({
            key,
            label: t('filter.range-from', { field: field.label }),
            type: 'date',
          });
          defs.push({
            key: `${key}${FILTER_RANGE_TO_SUFFIX}`,
            label: t('filter.range-to', { field: field.label }),
            type: 'date',
          });
          break;
        default:
          defs.push({ key, label: field.label, type: 'text', placeholder: field.label });
      }
    });
    // A presença é UM par de filtros por tela, cujas opções são os campos — e não um par por campo,
    // que dobraria a lista de filtros de toda tela por um recurso de exceção. Ver `FILTER_EMPTY_KEY`.
    if (presenceFields.length > 0) {
      const options = presenceFields.map((field) => ({ value: field.key, label: field.label }));
      defs.push({ key: `${filterKeyPrefix}${FILTER_EMPTY_KEY}`, label: t('filter.empty'), type: 'multiselect', options });
      defs.push({ key: `${filterKeyPrefix}${FILTER_FILLED_KEY}`, label: t('filter.filled'), type: 'multiselect', options });
    }
    return defs;
  }, [filterableFields, presenceFields, filterKeyPrefix, selectOptionLabels, referenceOptionsByEntity, t]);

  const matchesFilters = useCallback((values: RecordValues | undefined, tokenMap: Record<string, string[]>): boolean => {
    for (const field of filterableFields) {
      const key = `${filterKeyPrefix}${field.key}`;
      const tokenValues = tokenMap[key] ?? [];
      const value = fieldValue(values, field);
      // A data casa por INTERVALO, e cada ponta vale sozinha: só "de", só "até", ou os dois. Ambas as
      // pontas são inclusivas, e a comparação é entre strings `AAAA-MM-DD` — ordem lexicográfica e
      // cronológica coincidem, sem fuso no meio.
      if (field.type === 'date') {
        const from = tokenValues[0];
        const to = tokenMap[`${key}${FILTER_RANGE_TO_SUFFIX}`]?.[0];
        if (!from && !to) continue;
        const iso = toDateFieldInput(value);
        if (!iso) return false;
        if (from && iso < from) return false;
        if (to && iso > to) return false;
        continue;
      }
      if (tokenValues.length === 0) continue;
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
        default: {
          const query = tokenValues[0]?.toLowerCase() ?? '';
          const text = value == null ? '' : String(value).toLowerCase();
          if (query && !text.includes(query)) return false;
        }
      }
    }
    // Ao contrário das opções de um campo (qualquer uma), aqui TODOS os campos escolhidos valem: "sem
    // envio e sem cancelamento" é a fila; "sem um ou outro" não é fila nenhuma. Campo que
    // deixou de ser filtrável é ignorado, como o token de valor dele.
    const presenceHolds = (tokenKey: string, empty: boolean): boolean =>
      (tokenMap[`${filterKeyPrefix}${tokenKey}`] ?? []).every((fieldKey) => {
        const field = presenceFields.find((candidate) => candidate.key === fieldKey);
        return !field || isEmptyFieldValue(fieldValue(values, field)) === empty;
      });
    return presenceHolds(FILTER_EMPTY_KEY, true) && presenceHolds(FILTER_FILLED_KEY, false);
  }, [filterableFields, presenceFields, filterKeyPrefix]);

  const displayValue = useCallback((values: RecordValues | undefined, field: FieldDefinition): string => {
    const value = fieldValue(values, field);
    if (value == null || value === '') return '—';
    switch (field.type) {
      case 'date':
        return formatDateBR(value) || '—';
      case 'currency':
        return typeof value === 'number' ? formatCurrencyBRL(value) : '—';
      case 'checkbox':
        return t(value === true ? 'core.ui/answer.yes' : 'core.ui/answer.no');
      case 'select': {
        const labels = new Map(selectOptionLabels(field).map((o) => [o.value, o.label]));
        if (Array.isArray(value)) return value.map((v) => labels.get(v) ?? v).join(', ') || '—';
        return typeof value === 'string' ? (labels.get(value) ?? value) : '—';
      }
      case 'file':
        return fileNameFromUrl(String(value)) || '—';
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
  }, [selectOptionLabels, referenceOptionsByEntity, t]);

  const selectBadges = useCallback((values: RecordValues | undefined, field: FieldDefinition): CustomFieldBadgeItem[] => {
    const value = fieldValue(values, field);
    const selectedKeys = Array.isArray(value) ? value : (typeof value === 'string' && value ? [value] : []);
    const options = new Map(selectOptionLabels(field).map((o) => [o.value, o]));
    return selectedKeys.map((key) => {
      const option = options.get(key);
      return { label: option?.label ?? key, color: option?.color };
    });
  }, [selectOptionLabels]);

  const fieldItem = useCallback(
    (values: RecordValues | undefined, field: FieldDefinition, options?: { badges?: boolean }): CustomFieldCardItem => ({
      key: field.key,
      label: field.listLabel || undefined,
      value: displayValue(values, field),
      badges: field.type === 'select' && (field.optionsColored || options?.badges) ? selectBadges(values, field) : undefined,
      type: field.type === 'markdown' ? 'markdown' : 'text',
    }),
    [displayValue, selectBadges],
  );

  const cardItems = useCallback(
    (values: RecordValues | undefined): CustomFieldCardItem[] => listFields.map((field) => fieldItem(values, field)),
    [listFields, fieldItem],
  );

  const optionColor = useCallback(
    (values: RecordValues | undefined, field: FieldDefinition): string | undefined =>
      field.type === 'select' ? selectBadges(values, field).find((badge) => badge.color)?.color : undefined,
    [selectBadges],
  );

  return useMemo(() => ({
    listFields,
    filterDefs,
    matchesFilters,
    displayValue,
    cardItems,
    fieldItem,
    optionColor,
    searchText,
  }), [listFields, filterDefs, matchesFilters, displayValue, cardItems, fieldItem, optionColor, searchText]);
};
