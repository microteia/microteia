import { useCallback, useMemo } from 'react';
import { useRecords } from '../../../stores/useRecords';
import type { RecordCondition, RecordCountSpec } from '../../../domain/services/recordListQuery';
import { useRecordAggregates } from './useRecordAggregates';

export interface RecordSums {
  /** Grupo → a soma do campo nos registros que atendem às condições dele. `null` enquanto não chegou. */
  sums: Record<string, number | null>;
  loading: boolean;
}

/**
 * A soma de um campo numérico em cada grupo de condições, feita NO SERVIDOR — o total de um painel
 * ("a receber nos próximos 30 dias"), certo para qualquer tamanho de coleção. As condições, a releitura
 * e o índice que a combinação pede são os de `useRecordCounts`.
 *
 * Valor que não é número fica de fora da soma, em silêncio: é o comportamento do Firestore, e é por
 * isso que a porta existe para campo `currency` e `number`, que o kernel grava como número.
 */
export const useRecordSums = (
  collection: string,
  field: string,
  groups: Record<string, readonly RecordCondition[]>,
): RecordSums => {
  const { sumRecords } = useRecords();
  const measure = useCallback((spec: RecordCountSpec) => sumRecords(spec, field), [sumRecords, field]);
  const { values, loading } = useRecordAggregates('useRecordSums', collection, groups, measure);
  return useMemo(() => ({ sums: values, loading }), [values, loading]);
};
