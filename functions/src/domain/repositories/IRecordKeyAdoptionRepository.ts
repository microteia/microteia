import type { RecordKeyAdoptionIssue, RecordKeyAdoptionState } from '../schema/recordKeyAdoption';
import type { RecordKeyPlan } from '../schema/recordKeys';

export interface RecordKeyAdoptionRecord {
  id: string;
  data: Record<string, unknown>;
}

/** O que a adoção de UM registro pede: o plano das chaves em adoção, sobre o registro como está. */
export interface RecordKeyAdoptionRequest {
  plan: RecordKeyPlan;
  /** As chaves em adoção — `plan` só fala das que têm valor ou lacuna. */
  names: string[];
}

export interface RecordKeyAdoptionOutcome {
  /** O registro sumiu entre a página e a transação. */
  gone: boolean;
  reserved: number;
  issues: RecordKeyAdoptionIssue[];
}

/**
 * O job da adoção de chaves de uma coleção e os registros que ele percorre.
 *
 * `update` é a ÚNICA forma de mudar o job — o molde de `IAggregateBackfillRepository`. `adoptRecord`
 * é a única forma de reservar por conta da adoção: registro, reservas e `keyRefs` na MESMA transação,
 * porque uma reserva sem o `keyRefs` que a cita é uma reserva que ninguém solta.
 */
export interface IRecordKeyAdoptionRepository {
  listStates: (tenantId: string) => Promise<Map<string, RecordKeyAdoptionState>>;
  /** Devolve o estado gravado, ou `null` quando `mutate` decidiu não gravar nada. */
  update: (
    tenantId: string,
    collection: string,
    mutate: (current: RecordKeyAdoptionState | null) => RecordKeyAdoptionState | null,
  ) => Promise<RecordKeyAdoptionState | null>;
  /** Uma página de registros em ordem de id de documento — sem índice composto nenhum. */
  listRecords: (
    tenantId: string,
    collection: string,
    afterId: string | null,
    limit: number,
  ) => Promise<RecordKeyAdoptionRecord[]>;
  /**
   * Relê o registro DENTRO da transação, planeja sobre o que leu (`planFor`) e aplica
   * `decideRecordKeyAdoption`. Grava só reservas e `keyRefs`: nenhum outro campo do registro, nem
   * `updatedAt`.
   */
  adoptRecord: (
    tenantId: string,
    collection: string,
    recordId: string,
    planFor: (data: Record<string, unknown>) => RecordKeyAdoptionRequest,
  ) => Promise<RecordKeyAdoptionOutcome>;
}
