import type { AggregateBackfillState } from '../schema/aggregateBackfill';

/**
 * O job do recálculo de agregados de uma tela, visto do cliente: só leitura, mais o pedido de
 * conferência. Quem grava o job é o servidor — a regra do Firestore nega escrita ao cliente, e um
 * método de escrita aqui prometeria o que ela recusa.
 */
export interface IAggregateBackfillRepository {
  /** `null` quando a tela nunca teve job, ou quando a leitura foi recusada. */
  subscribe: (
    tenantId: string,
    table: string,
    onChange: (state: AggregateBackfillState | null) => void,
  ) => () => void;
  /** Pede ao servidor que confira declarado × recalculado e ponha em marcha o que falta. */
  reconcile: (tenantId: string) => Promise<void>;
}
