import type { AggregateBackfillState } from '../schema/aggregateBackfill';

export interface AggregateBackfillParent {
  id: string;
  data: Record<string, unknown>;
}

/**
 * O documento do job do recálculo e os registros que ele percorre.
 *
 * `update` é a ÚNICA forma de mudar o job: lê e grava na mesma transação, e a decisão do que gravar é
 * do domínio (`mutate`). É o que faz duas entregas do mesmo gatilho, ou um gatilho e a callable ao
 * mesmo tempo, se encontrarem no documento em vez de pisarem uma na outra.
 */
export interface IAggregateBackfillRepository {
  listStates: (tenantId: string) => Promise<Map<string, AggregateBackfillState>>;
  /** Devolve o estado gravado, ou `null` quando `mutate` decidiu não gravar nada. */
  update: (
    tenantId: string,
    table: string,
    mutate: (current: AggregateBackfillState | null) => AggregateBackfillState | null,
  ) => Promise<AggregateBackfillState | null>;
  /** Uma página de pais em ordem de id de documento — sem índice composto nenhum. */
  listParents: (
    tenantId: string,
    collection: string,
    afterId: string | null,
    limit: number,
  ) => Promise<AggregateBackfillParent[]>;
  /**
   * Grava só os campos recalculados, com a marca do recálculo e SEM tocar em `updatedAt`: o registro
   * não foi alterado por ninguém, ele passou a ter o valor que já deveria ter.
   */
  writeParent: (
    tenantId: string,
    collection: string,
    id: string,
    payload: Record<string, unknown>,
  ) => Promise<void>;
}
