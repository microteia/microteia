import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePortal } from '../../../../../stores/usePortal';
import { useT } from '../../../../shared/i18n/useT';
import type { PortalRecord } from '../../../../../domain/entities/Portal';
import type { FilterDef, FilterToken } from '../../../../components/ui/CompositeFilter';
import type { PortalChildSection, PortalRecordCard } from '../../Portal.viewmodel';
import { usePortalRecordFormat } from '../../usePortalRecordFormat';
import { portalCardArrangement, type PortalCardArrangement } from '../../resolvePortalTemplate';

/** Sem filtro, os mais recentes: o que se procura de verdade se encontra filtrando. */
export const PORTAL_CHILDREN_RECENT = 15;
/** Com filtro, a janela sobe — e para aqui. O servidor nunca entrega mais que isto de uma vez. */
export const PORTAL_CHILDREN_FILTER_MAX = 300;

const SEARCH = 'search';

export interface PortalChildListProps {
  child: PortalChildSection;
  onOpen: (collection: string, id: string) => void;
  onCreate: (collection: string) => void;
}

export interface PortalChildListViewModel {
  filterDefs: FilterDef[];
  tokens: FilterToken[];
  setTokens: (tokens: FilterToken[]) => void;
  cards: PortalRecordCard[];
  /** O arranjo que a tela-filha declara (`portal.template.card`); `null`, as linhas de sempre. */
  arrangement: PortalCardArrangement | null;
  loading: boolean;
  failed: boolean;
  /** O que a pessoa precisa saber sobre a janela — "os 15 mais recentes", "o filtro olhou 300". */
  windowNote: string | null;
  emptyText: string;
  createLabel: string | null;
  create: () => void;
  open: (id: string) => void;
  /** O mesmo `open`, na forma que a lista de cartões declarada chama. */
  openCard: (collection: string, id: string) => void;
}

/**
 * Os filhos de UM registro — as notas de UM prestador —, pedidos ao servidor só deste pai, os mais
 * recentes primeiro e com limite. O filtro corre sobre essa janela, como na listagem do escritório;
 * filtrar alarga a janela até o teto, e a tela diz quando o teto foi alcançado.
 */
export const usePortalChildListViewModel = ({ child, onOpen, onCreate }: PortalChildListProps): PortalChildListViewModel => {
  const { subscribeChildren } = usePortal();
  const { formatValue, cardOf } = usePortalRecordFormat();
  const t = useT('core.tenant');

  const [tokens, setTokens] = useState<FilterToken[]>([]);
  const [records, setRecords] = useState<PortalRecord[]>([]);
  const [loadedKey, setLoadedKey] = useState('');
  const [failedKey, setFailedKey] = useState('');

  const filtering = tokens.length > 0;
  const max = filtering ? PORTAL_CHILDREN_FILTER_MAX : PORTAL_CHILDREN_RECENT;
  const requestKey = `${child.collection}|${child.parentKey}|${max}`;

  useEffect(() => subscribeChildren(
    child.collection,
    child.parentKey,
    max,
    (next) => {
      setRecords(next);
      setLoadedKey(requestKey);
    },
    () => setFailedKey(requestKey),
  ), [subscribeChildren, child.collection, child.parentKey, max, requestKey]);

  const filterDefs = useMemo<FilterDef[]>(() => [
    { key: SEARCH, label: t('portal.filter.search'), type: 'text', placeholder: t('portal.filter.search.placeholder') },
    ...child.screen.fields
      .filter((field) => field.type === 'select' && (field.options ?? []).length > 0)
      .map((field) => ({
        key: field.key,
        label: field.label,
        type: 'multiselect' as const,
        options: (field.options ?? []).map((option) => ({ value: option.key, label: option.label })),
      })),
  ], [child.screen, t]);

  const filtered = useMemo(() => {
    if (!filtering) return records;
    const search = (tokens.find((token) => token.key === SEARCH)?.values[0] ?? '').trim().toLowerCase();
    const picks = tokens.filter((token) => token.key !== SEARCH && token.values.length > 0);
    return records.filter((record) => {
      if (search) {
        const text = [record.title, ...child.screen.fields.map((field) => formatValue(field, record).value)]
          .join(' ')
          .toLowerCase();
        if (!text.includes(search)) return false;
      }
      return picks.every((token) => {
        const value = record.data[token.key];
        const values = Array.isArray(value) ? value.map(String) : value === undefined || value === null ? [] : [String(value)];
        return token.values.some((wanted) => values.includes(wanted));
      });
    });
  }, [filtering, records, tokens, child.screen, formatValue]);

  const cards = useMemo(() => filtered.map((record) => cardOf(child.screen, record)), [filtered, cardOf, child.screen]);

  const windowNote = filtering
    ? records.length >= PORTAL_CHILDREN_FILTER_MAX ? t('portal.children.window', { count: String(PORTAL_CHILDREN_FILTER_MAX) }) : null
    : records.length >= PORTAL_CHILDREN_RECENT ? t('portal.children.recent', { count: String(PORTAL_CHILDREN_RECENT) }) : null;

  const create = useCallback(() => onCreate(child.collection), [onCreate, child.collection]);
  const open = useCallback((id: string) => onOpen(child.collection, id), [onOpen, child.collection]);

  return {
    filterDefs,
    tokens,
    setTokens,
    cards,
    arrangement: portalCardArrangement(child.screen),
    loading: loadedKey !== requestKey && failedKey !== requestKey,
    failed: failedKey === requestKey,
    windowNote,
    emptyText: filtering ? t('portal.children.empty-filter') : t('portal.records.empty'),
    createLabel: child.createLabel,
    create,
    open,
    openCard: onOpen,
  };
};
