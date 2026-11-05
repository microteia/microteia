import { useEffect, useMemo, useState } from 'react';
import { useRecords } from '../../../stores/useRecords';
import { storeEvents, StoreEvents } from '../../../infrastructure/events/StoreEventEmitter';
import { recordConditionsQuery } from '../../../domain/services/recordListQuery';
import type { RecordCondition } from '../../../domain/services/recordListQuery';

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
 * `null` e o console do navegador traz o link do índice. Não é ao vivo: o número é relido quando um registro é gravado nesta sessão e
 * quando a pessoa volta à aba. Custa uma leitura a cada mil registros contados.
 */
export const useRecordCounts = (collection: string, groups: Record<string, readonly RecordCountClause[]>): RecordCounts => {
  const { countRecords } = useRecords();
  const groupsKey = useMemo(() => JSON.stringify(Object.entries(groups).sort(([left], [right]) => (left < right ? -1 : 1))), [groups]);
  const [revision, setRevision] = useState(0);
  const [answer, setAnswer] = useState<{ key: string; counts: Record<string, number | null> }>({ key: '', counts: {} });

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
    const entries = JSON.parse(groupsKey) as [string, RecordCountClause[]][];
    Promise.all(entries.map(async ([name, clauses]) => {
      const query = recordConditionsQuery(clauses);
      if (!query) {
        console.warn(`[useRecordCounts] ${collection}/${name}: one day range per group, with at least one end as YYYY-MM-DD.`);
        return [name, null] as const;
      }
      try {
        return [name, await countRecords({ collection, ...query })] as const;
      } catch (error) {
        // É aqui que o índice que falta aparece: a mensagem do Firestore traz o link que o cria.
        console.warn(`[useRecordCounts] ${collection}/${name}:`, (error as Error).message);
        return [name, null] as const;
      }
    })).then((results) => {
      if (!cancelled) setAnswer({ key: requestKey, counts: Object.fromEntries(results) });
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [collection, groupsKey, requestKey, countRecords, revision]);

  return useMemo(() => {
    const current = answer.key === requestKey;
    const names = (JSON.parse(groupsKey) as [string, unknown][]).map(([name]) => name);
    const counts = Object.fromEntries(names.map((name) => [name, current ? (answer.counts[name] ?? null) : null]));
    return { counts, loading: !current };
  }, [answer, requestKey, groupsKey]);
};
