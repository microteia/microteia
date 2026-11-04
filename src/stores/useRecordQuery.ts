import { useEffect, useMemo } from 'react';
import type { EntityRecord } from '../domain/entities';
import type { RecordQuerySpec } from '../domain/services/recordListQuery';
import { useRecords } from './useRecords';

const NONE: EntityRecord[] = [];

/** A chave de uma consulta no `RecordStore`: o plano SEM o tamanho, que só muda o quanto se lê dela. */
export const recordQueryKey = (spec: RecordQuerySpec): string => {
  const { limit, ...base } = spec;
  void limit;
  return JSON.stringify(base);
};

export interface RecordQueryState {
  records: EntityRecord[];
  /** A consulta já respondeu ao menos uma vez — com dados ou com recusa. */
  loaded: boolean;
}

/**
 * Mantém uma consulta de listagem assinada enquanto o componente estiver montado. `null` não consulta
 * nada — é a listagem que fica na janela da coleção.
 */
export const useRecordQuery = (spec: RecordQuerySpec | null): RecordQueryState => {
  const { watchQuery, queryResults } = useRecords();
  const serialized = spec ? JSON.stringify(spec) : '';
  const key = spec ? recordQueryKey(spec) : '';
  useEffect(() => (serialized ? watchQuery(JSON.parse(serialized) as RecordQuerySpec) : undefined), [watchQuery, serialized]);
  const records = key ? queryResults[key] : undefined;
  return useMemo(() => ({ records: records ?? NONE, loaded: records !== undefined }), [records]);
};
