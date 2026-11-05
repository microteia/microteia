import { useEffect, useMemo, useState } from 'react';
import { storeEvents, StoreEvents } from '../../../infrastructure/events/StoreEventEmitter';
import { recordConditionsQuery } from '../../../domain/services/recordListQuery';
import type { RecordCondition, RecordCountSpec } from '../../../domain/services/recordListQuery';

export interface RecordAggregates {
  /** Grupo → o número dele. `null` enquanto não chegou, ou quando a consulta foi recusada. */
  values: Record<string, number | null>;
  loading: boolean;
}

/**
 * O núcleo de `useRecordCounts` e `useRecordSums`: um número do SERVIDOR por grupo de condições.
 * Escrito uma vez porque as duas portas têm de concordar em tudo o que não é a medida — a forma das
 * condições, a recusa do que não cabe numa consulta, quando reler. Duas cópias seriam onde o total de
 * um painel passa a reler numa hora e a contagem ao lado em outra.
 *
 * Não é ao vivo: relê quando um registro é gravado nesta sessão e quando a pessoa volta à aba. Só o
 * CONTEÚDO de `groups` importa — um literal novo a cada desenho não refaz a consulta. `measure` tem de
 * ser estável (`useCallback`).
 */
export const useRecordAggregates = (
  hook: string,
  collection: string,
  groups: Record<string, readonly RecordCondition[]>,
  measure: (spec: RecordCountSpec) => Promise<number>,
): RecordAggregates => {
  const groupsKey = useMemo(() => JSON.stringify(Object.entries(groups).sort(([left], [right]) => (left < right ? -1 : 1))), [groups]);
  const [revision, setRevision] = useState(0);
  const [answer, setAnswer] = useState<{ key: string; values: Record<string, number | null> }>({ key: '', values: {} });

  useEffect(() => {
    const bump = () => setRevision((value) => value + 1);
    const onVisible = () => { if (document.visibilityState === 'visible') bump(); };
    const off = storeEvents.on(StoreEvents.RECORDS_UPDATED, bump);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      off();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const requestKey = `${collection}\u0000${groupsKey}`;
  useEffect(() => {
    if (!collection) return undefined;
    let cancelled = false;
    const entries = JSON.parse(groupsKey) as [string, RecordCondition[]][];
    Promise.all(entries.map(async ([name, conditions]) => {
      const query = recordConditionsQuery(conditions);
      if (!query) {
        console.warn(`[${hook}] ${collection}/${name}: one day range per group, with at least one end as YYYY-MM-DD.`);
        return [name, null] as const;
      }
      try {
        return [name, await measure({ collection, ...query })] as const;
      } catch (error) {
        // É aqui que o índice que falta aparece: a mensagem do Firestore traz o link que o cria.
        console.warn(`[${hook}] ${collection}/${name}:`, (error as Error).message);
        return [name, null] as const;
      }
    })).then((results) => {
      if (!cancelled) setAnswer({ key: requestKey, values: Object.fromEntries(results) });
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [hook, collection, groupsKey, requestKey, measure, revision]);

  return useMemo(() => {
    const current = answer.key === requestKey;
    const names = (JSON.parse(groupsKey) as [string, unknown][]).map(([name]) => name);
    const values = Object.fromEntries(names.map((name) => [name, current ? (answer.values[name] ?? null) : null]));
    return { values, loading: !current };
  }, [answer, requestKey, groupsKey]);
};
