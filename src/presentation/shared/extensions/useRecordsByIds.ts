import { useEffect, useMemo } from 'react';
import { useRecords } from '../../../stores/useRecords';
import type { EntityRecord } from '../../../domain/entities';

/**
 * Os registros pedidos de uma coleção, pelo id — o nome de cada parte de um processo, por exemplo. O
 * que já está carregado responde na hora; o que não está é trazido do servidor numa leitura por lote,
 * e aparece quando chega. Id que não existe (ou que a pessoa não pode ver) fica de fora do mapa.
 *
 * Existe porque `useCollection` é a janela dos mais recentes: uma view que montava o nome de uma
 * pessoa a partir dela perdia quem foi cadastrado antes dos 500 mais novos.
 */
export const useRecordsByIds = (collection: string, ids: readonly string[]): Record<string, EntityRecord> => {
  const { knownRecordsByCollection, ensureRecords } = useRecords();
  const key = useMemo(
    () => JSON.stringify([...new Set(ids.filter((id) => typeof id === 'string' && id !== ''))].sort()),
    [ids],
  );

  useEffect(() => {
    if (collection) ensureRecords(collection, JSON.parse(key) as string[]);
  }, [collection, key, ensureRecords]);

  return useMemo(() => {
    const wanted = new Set(JSON.parse(key) as string[]);
    const found: Record<string, EntityRecord> = {};
    for (const record of knownRecordsByCollection[collection] ?? []) {
      if (wanted.has(record.id)) found[record.id] = record;
    }
    return found;
  }, [knownRecordsByCollection, collection, key]);
};
