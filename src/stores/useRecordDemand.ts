import { useEffect, useMemo } from 'react';
import { RECORD_WINDOW_DEFAULT } from '../domain/repositories/IRecordRepository';
import { useRecords } from './useRecords';

/**
 * Mantém as coleções assinadas enquanto o componente estiver montado. É a forma de dizer ao
 * `RecordStore` "preciso destes registros na memória": sem ninguém pedindo, a coleção não é lida.
 */
export const useRecordDemand = (collections: readonly string[], limit: number = RECORD_WINDOW_DEFAULT): void => {
  const { demand } = useRecords();
  const key = useMemo(
    () => JSON.stringify([...new Set(collections.filter((collection) => collection !== ''))].sort()),
    [collections],
  );
  useEffect(() => demand(JSON.parse(key) as string[], limit), [demand, key, limit]);
};
