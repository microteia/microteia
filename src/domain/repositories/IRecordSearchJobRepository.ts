import type { RecordSearchJobState } from '../schema/recordSearch';

/**
 * O backfill da busca de uma coleção, visto do cliente: só leitura, mais o pedido de conferência. Quem
 * grava o job é o servidor — a regra do Firestore nega escrita ao cliente.
 */
export interface IRecordSearchJobRepository {
  /** `null` quando a coleção nunca teve backfill, ou quando a leitura foi recusada. */
  subscribeBackfill: (
    tenantId: string,
    collection: string,
    onChange: (state: RecordSearchJobState | null) => void,
  ) => () => void;
  /** Pede ao servidor que confira o que entra na busca e ponha em marcha o que falta. */
  reconcile: (tenantId: string) => Promise<void>;
}
