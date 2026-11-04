import { useEffect, useMemo, useState } from 'react';
import { useRecords } from '../../stores/useRecords';
import { searchQueryTerms } from '../../domain/schema/recordSearch';
import type { EntityRecord } from '../../domain/entities';

/** Espera entre a última tecla e a consulta: digitar "curatela" não pode custar oito buscas. */
const SEARCH_DEBOUNCE_MS = 250;

const NO_RESULTS: EntityRecord[] = [];

export interface ServerRecordSearch {
  /** O que o servidor achou para o texto ATUAL — a resposta de um texto anterior nunca aparece aqui. */
  results: EntityRecord[];
  /** `coleção/id` de cada resultado: o registro achado por um campo que não é o título também conta. */
  matches: ReadonlySet<string>;
}

export const recordMatchKey = (collection: string, id: string): string => `${collection}/${id}`;

/**
 * A busca no servidor sobre algumas coleções, para quem já busca em memória: o que volta é somado ao
 * que a janela carregada já achou. Sem palavra que a busca leia (menos de duas letras), não consulta.
 */
export const useServerRecordSearch = (
  text: string,
  collections: readonly string[],
  limit: number,
): ServerRecordSearch => {
  const { searchRecords } = useRecords();
  const [answer, setAnswer] = useState<{ key: string; results: EntityRecord[] }>({ key: '', results: NO_RESULTS });

  const searchable = searchQueryTerms(text).length > 0;
  const key = useMemo(() => JSON.stringify([text.trim(), [...collections].sort(), limit]), [text, collections, limit]);

  useEffect(() => {
    if (!searchable || collections.length === 0) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      Promise.all(collections.map((collection) => searchRecords(collection, text, limit).catch(() => NO_RESULTS)))
        .then((lists) => {
          if (!cancelled) setAnswer({ key, results: lists.flat() });
        })
        .catch(() => undefined);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, searchable, collections, text, limit, searchRecords]);

  const results = searchable && answer.key === key ? answer.results : NO_RESULTS;
  const matches = useMemo(() => new Set(results.map((record) => recordMatchKey(record.collection, record.id))), [results]);
  return { results, matches };
};
