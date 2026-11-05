import { useMemo } from 'react';
import { useRecords } from '../../../stores/useRecords';
import type { RecordCondition } from '../../../domain/services/recordListQuery';
import { useRecordAggregates } from './useRecordAggregates';

/**
 * Uma condição da contagem: igualdade, por padrão; `in` para vários valores, `array-contains` num campo
 * múltiplo — ou um intervalo de DIA (`{ field, from, to }`), uma ponta ou as duas, inclusivas.
 */
export type RecordCountClause = RecordCondition;

export interface RecordCounts {
  /** Grupo → quantos registros atendem às condições dele. `null` enquanto o número não chegou. */
  counts: Record<string, number | null>;
  loading: boolean;
}

/**
 * Quantos registros atendem a cada grupo de condições, contados NO SERVIDOR — o número de um painel,
 * certo para qualquer tamanho de coleção. `useCollection` é a janela dos mais recentes, e um painel que
 * contava sobre ela errava em silêncio a partir do registro 501.
 *
 * Um grupo por número (`{ aberto: [{ field: 'status', value: 'open' }] }`), e as condições de um grupo
 * valem todas juntas. A igualdade com um intervalo de dia (`vencidos`: pendente E vencimento até ontem)
 * pede o índice composto que a extensão declara em `manifest.backend.indexes` — sem ele, o grupo fica
 * `null` e o console do navegador traz o link do índice. Custa uma leitura a cada mil registros
 * contados.
 */
export const useRecordCounts = (collection: string, groups: Record<string, readonly RecordCountClause[]>): RecordCounts => {
  const { countRecords } = useRecords();
  const { values, loading } = useRecordAggregates('useRecordCounts', collection, groups, countRecords);
  return useMemo(() => ({ counts: values, loading }), [values, loading]);
};
