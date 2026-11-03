import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PortalListCursor, PortalListPage, PortalListQuery } from '../../../../domain/entities/Portal';

export const PORTAL_LIST_PAGE_SIZE = 25;

/** O tempo de digitação sem consulta: cada letra abriria uma escuta nova no Firestore. */
const SEARCH_DELAY_MS = 300;

export type PortalListSubscriber<T> = (
  page: PortalListQuery,
  onUpdate: (page: PortalListPage<T>) => void,
  onError: () => void,
) => () => void;

export interface PortalPagedList<T> {
  items: T[];
  loading: boolean;
  /** O que a pessoa digitou — a consulta segue um instante depois. */
  search: string;
  setSearch: (value: string) => void;
  /** A busca que está valendo na lista, já aparada. */
  term: string;
  /** 1 é a primeira. */
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  previous: () => void;
  next: () => void;
  /** Nada carregando, nada buscado, primeira página vazia: não há o que listar. */
  isEmpty: boolean;
}

/**
 * Uma lista da aba Portal paginada no SERVIDOR: escuta só a página aberta, ao vivo, e anda por cursor.
 * A lista escutava a coleção inteira — numa prefeitura, milhares de convidados lidos a cada mudança.
 *
 * O "carregando" é derivado da chave da consulta, e não de um estado ligado no efeito: a página que
 * chegou responde pela consulta que a pediu, e a que ainda não chegou é a que está carregando.
 */
export const usePortalPagedList = <T>(subscribe: PortalListSubscriber<T> | null): PortalPagedList<T> => {
  const [search, setSearchState] = useState('');
  const [term, setTerm] = useState('');
  const [cursors, setCursors] = useState<PortalListCursor[]>([]);
  const [result, setResult] = useState<{ key: string; page: PortalListPage<T> } | null>(null);

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed === term) return;
    const timer = setTimeout(() => {
      setTerm(trimmed);
      setCursors([]);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search, term]);

  const after = cursors.length > 0 ? cursors[cursors.length - 1] : null;
  const key = JSON.stringify([term, after]);

  // A consulta sai da CHAVE, e não do cursor: o objeto do cursor muda de identidade sem mudar de
  // valor, e cada identidade nova reabriria a escuta.
  useEffect(() => {
    if (!subscribe) return;
    const [queryTerm, queryAfter] = JSON.parse(key) as [string, PortalListCursor | null];
    return subscribe(
      { search: queryTerm, after: queryAfter, pageSize: PORTAL_LIST_PAGE_SIZE },
      (page) => setResult({ key, page }),
      () => setResult({ key, page: { items: [], next: null } }),
    );
  }, [subscribe, key]);

  const current = result?.key === key ? result.page : null;
  const loading = !!subscribe && current === null;
  const items = useMemo(() => current?.items ?? [], [current]);
  const nextCursor = current?.next ?? null;

  const setSearch = useCallback((value: string) => setSearchState(value), []);
  const previous = useCallback(() => setCursors((stack) => stack.slice(0, -1)), []);
  const next = useCallback(() => {
    if (nextCursor) setCursors((stack) => [...stack, nextCursor]);
  }, [nextCursor]);

  return {
    items,
    loading,
    search,
    setSearch,
    term,
    page: cursors.length + 1,
    hasPrevious: cursors.length > 0,
    hasNext: nextCursor !== null,
    previous,
    next,
    isEmpty: !loading && cursors.length === 0 && term === '' && items.length === 0,
  };
};
