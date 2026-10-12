import type { RecordKeyAdoptionState } from '../schema/recordKeyAdoption';

/**
 * O job da adoção de chaves de uma coleção, visto do cliente: só leitura, mais o pedido de
 * conferência. Quem grava o job é o servidor — a regra do Firestore nega escrita ao cliente.
 */
export interface IRecordKeyAdoptionRepository {
  /** `null` quando a coleção nunca teve job, ou quando a leitura foi recusada. */
  subscribe: (
    tenantId: string,
    collection: string,
    onChange: (state: RecordKeyAdoptionState | null) => void,
  ) => () => void;
  /** Pede ao servidor que confira declarado × adotado e ponha em marcha o que falta. */
  reconcile: (tenantId: string) => Promise<void>;
}
