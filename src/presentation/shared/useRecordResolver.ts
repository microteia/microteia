import { useCallback, useMemo } from 'react';
import { useRecords } from '../../stores/useRecords';
import type { RecordResolver } from '../../domain/schema/referenceScope';

/**
 * Resolve um registro referenciado a partir do que o `RecordStore` já conhece — não há busca nova
 * aqui: quem traz o apontado que faltava é `useEnsureReferencedRecords`. Devolve sempre o próprio registro: os campos
 * estão na raiz em qualquer coleção.
 */
export const useRecordResolver = (): RecordResolver => {
  // Os conhecidos: a janela assinada e o que veio por id (`useEnsureReferencedRecords`).
  const { knownRecordsByCollection: recordsByCollection } = useRecords();

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
