import { createContext, useContext } from 'react';
import type { EntityRecord, EntityRecordValues } from '../domain/entities';

export interface RecordStoreState {
  /** Registros por COLEÇÃO — a mesma chave que identifica a tela e a entidade. */
  recordsByCollection: Record<string, EntityRecord[]>;
  allRecords: EntityRecord[];
  /**
   * A janela carregada MAIS os registros trazidos do servidor por id (`ensureRecords`) ou por busca
   * (`searchRecords`). É o que resolve o nome de um registro apontado e o que o seletor de referência
   * oferece. A listagem continua lendo `recordsByCollection`: um registro achado por busca não entra
   * na lista de ninguém.
   */
  knownRecordsByCollection: Record<string, EntityRecord[]>;
  /** Traz, numa leitura por lote, os registros pedidos que ninguém carregou ainda. Pedido repetido não lê de novo. */
  ensureRecords: (collection: string, ids: readonly string[]) => void;
  /** A busca no servidor. O que volta passa a ser conhecido — o seletor o oferece, o cartão o nomeia. */
  searchRecords: (collection: string, text: string, limit: number) => Promise<EntityRecord[]>;
  isLoading: boolean;
  createRecord: (
    collection: string,
    data: EntityRecordValues,
    recordId?: string,
  ) => Promise<EntityRecord>;
  /** Id gerado no cliente para um registro que ainda não existe. Ver `IRecordRepository.newId`. */
  newRecordId: (collection: string) => string;
  updateRecord: (collection: string, recordId: string, data: EntityRecordValues) => Promise<void>;
  deleteRecord: (collection: string, recordId: string) => Promise<void>;
}

export const RecordContext = createContext<RecordStoreState | null>(null);

export const useRecords = (): RecordStoreState => {
  const ctx = useContext(RecordContext);
  if (!ctx) throw new Error('useRecords must be used within RecordStoreProvider');
  return ctx;
};
