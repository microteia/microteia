import type { RecordSequenceEntry } from '../schema/recordSequence';

/**
 * As reservas de chave que acompanham uma gravação — a metade do lote que não é o registro.
 *
 * No backend a garantia não vem da regra do Firestore (o Admin SDK a ignora): vem de `tx.create`
 * dentro de uma transação, que falha se o documento já existe. É o mesmo efeito, obtido pelo
 * mecanismo que existe deste lado.
 */
export interface RecordKeyReservation {
  keyId: string;
  keyName: string;
  values: string[];
}

export interface RecordKeyMutation {
  create: RecordKeyReservation[];
  release: string[];
}

/** A reserva que já pertence a outro registro. É o que vira recusa do passo, com o valor à vista. */
export class RecordKeyTakenError extends Error {
  readonly keyName: string;

  readonly values: string[];

  constructor(keyName: string, values: string[]) {
    super(`Record key "${keyName}" is already taken by another record.`);
    this.name = 'RecordKeyTakenError';
    this.keyName = keyName;
    this.values = values;
  }
}

export interface IWorkflowMutationRepository {
  getById: (
    tenantId: string,
    collection: string,
    id: string,
  ) => Promise<Record<string, unknown> | null>;
  /** Um id vago da coleção, para que a reserva possa apontar para o registro antes de ele existir. */
  newId: (tenantId: string, collection: string) => string;
  /**
   * De quem é cada reserva (id da reserva → id do registro que a detém). A reserva livre não aparece.
   *
   * É a leitura que faz da chave `primary` um ENDEREÇO — o `upsert` que casa pela chave natural — e a
   * que a simulação usa para dizer, sem gravar, que o valor já é de outro registro.
   */
  findKeyHolders: (tenantId: string, keyIds: readonly string[]) => Promise<Map<string, string>>;
  /**
   * `sequences` são os números que o registro recebe ao nascer (`autoValue.sequence`): cada contador
   * avança na MESMA transação que grava o registro, e o valor formatado entra no documento. O que foi
   * atribuído fica no documento, e quem grava o relê como sempre.
   */
  create: (
    tenantId: string,
    collection: string,
    data: Record<string, unknown>,
    id?: string,
    keys?: RecordKeyMutation,
    sequences?: RecordSequenceEntry[],
  ) => Promise<string>;
  update: (
    tenantId: string,
    collection: string,
    id: string,
    data: Record<string, unknown>,
    keys?: RecordKeyMutation,
  ) => Promise<void>;
  delete: (tenantId: string, collection: string, id: string, releaseKeyIds?: string[]) => Promise<void>;
}
