import { useCallback, useMemo } from 'react';
import { useRecords } from '../../stores/useRecords';
import type { RecordResolver } from '../../domain/schema/referenceScope';

/**
 * Resolve um registro referenciado a partir do que o `RecordStore` já mantém em memória — não há
 * busca nova: ele assina todas as telas do tenant. Devolve sempre o próprio registro: os campos
 * estão na raiz em qualquer coleção.
 */
export const useRecordResolver = (): RecordResolver => {
  const { recordsByCollection } = useRecords();

  const dynamicIndexes = useMemo(() => {
    const result = new Map<string, Map<string, Record<string, unknown>>>();
    for (const [collection, records] of Object.entries(recordsByCollection)) {
      result.set(
        collection,
        new Map(records.map((record) => [record.id, record as Record<string, unknown>])),
      );
    }
    return result;
  }, [recordsByCollection]);

  return useCallback(
    (refEntity, id) => dynamicIndexes.get(refEntity)?.get(id) ?? null,
    [dynamicIndexes],
  );
};
