import { useCallback, useMemo } from 'react';
import { useRecords } from '../../stores/useRecords';
import { usePersonStore } from '../../stores/usePersonStore';
import { useCaseStore } from '../../stores/useCaseStore';
import { useContractStore } from '../../stores/useContractStore';
import { useDeadlineStore } from '../../stores/useDeadlineStore';
import { useFinancialStore } from '../../stores/useFinancialStore';
import type { RecordResolver } from '../../domain/schema/referenceScope';

interface Identified {
  id: string;
}

const indexById = <T extends Identified>(items: T[]): Map<string, T> =>
  new Map(items.map((item) => [item.id, item]));

/**
 * Resolve um registro referenciado a partir do que os stores já mantêm em memória — não há busca
 * nova: o `RecordStore` assina todas as telas do tenant e os stores fixos carregam suas listas.
 * Devolve sempre o próprio registro: os campos estão na raiz em qualquer coleção.
 */
export const useRecordResolver = (): RecordResolver => {
  const { recordsByCollection } = useRecords();
  const { persons } = usePersonStore();
  const { cases } = useCaseStore();
  const { contracts } = useContractStore();
  const { deadlines } = useDeadlineStore();
  const { financials } = useFinancialStore();

  const nativeIndexes = useMemo(
    () => ({
      persons: indexById(persons),
      cases: indexById(cases),
      contracts: indexById(contracts),
      deadlines: indexById(deadlines),
      financials: indexById(financials),
    }),
    [persons, cases, contracts, deadlines, financials],
  );

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
    (refEntity, id) => {
      const native = nativeIndexes[refEntity as keyof typeof nativeIndexes];
      if (native) return (native.get(id) as Record<string, unknown> | undefined) ?? null;
      return dynamicIndexes.get(refEntity)?.get(id) ?? null;
    },
    [nativeIndexes, dynamicIndexes],
  );
};
