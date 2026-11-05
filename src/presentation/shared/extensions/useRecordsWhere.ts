import { useMemo } from 'react';
import { useRecordQuery } from '../../../stores/useRecordQuery';
import {
  RECORD_LIST_PAGE_SIZE,
  RECORDS_WHERE_MAX,
  orderRecordsBy,
  recordConditionsQuery,
  recordMatchesQuery,
} from '../../../domain/services/recordListQuery';
import type { RecordCondition, RecordQuerySpec } from '../../../domain/services/recordListQuery';
import type { EntityRecord } from '../../../domain/entities';

export interface RecordsWhereOptions {
  orderBy?: { field: string; dir?: 'asc' | 'desc' };
  limit?: number;
}

export interface RecordsWhere {
  records: EntityRecord[];
  loading: boolean;
  /** Veio tudo o que se pediu: pode haver mais além do `limit`. */
  hasMore: boolean;
}

const NONE: EntityRecord[] = [];

/**
 * Os registros que atendem às condições, consultados NO SERVIDOR e ao vivo — o cartão "vencem esta
 * semana" de um painel, certo para qualquer tamanho de coleção. `useCollection` é a janela dos mais
 * recentes, e o prazo cadastrado há um ano, que vence amanhã, não estava nela.
 *
 * As condições são as do `useRecordCounts`. A consulta é conferida de novo em memória: quem só lê o que
 * o nomeia recebe a janela restrita no lugar dela (a regra recusaria somar as condições à
 * visibilidade), e é o filtro em memória que a deixa com a mesma resposta.
 */
export const useRecordsWhere = (
  collection: string,
  conditions: readonly RecordCondition[],
  options: RecordsWhereOptions = {},
): RecordsWhere => {
  const conditionsKey = JSON.stringify(conditions);
  const limit = Math.min(Math.max(Math.floor(options.limit ?? RECORD_LIST_PAGE_SIZE), 1), RECORDS_WHERE_MAX);
  const orderField = options.orderBy?.field ?? null;
  const orderDir = options.orderBy?.dir ?? 'asc';

  const spec = useMemo((): RecordQuerySpec | null => {
    if (!collection) return null;
    const query = recordConditionsQuery(JSON.parse(conditionsKey) as RecordCondition[]);
    if (!query) {
      console.warn(`[useRecordsWhere] ${collection}: one day range, with at least one end as YYYY-MM-DD.`);
      return null;
    }
    return {
      collection,
      limit,
      anyOf: [],
      allOf: query.allOf,
      range: query.range,
      orderBy: orderField ? { field: orderField, dir: orderDir } : null,
    };
  }, [collection, conditionsKey, limit, orderField, orderDir]);

  const { records, loaded } = useRecordQuery(spec);

  return useMemo(() => {
    if (!spec) return { records: NONE, loading: false, hasMore: false };
    const matching = orderRecordsBy(records.filter((record) => recordMatchesQuery(record, spec)), spec.orderBy);
    return { records: matching.slice(0, spec.limit), loading: !loaded, hasMore: matching.length >= spec.limit };
  }, [spec, records, loaded]);
};
