import type {
  IWorkflowMutationRepository,
  RecordKeyMutation,
} from './IWorkflowMutationRepository';
import { RecordKeyTakenError } from './IWorkflowMutationRepository';
import type { RecordSequenceEntry } from '../schema/recordSequence';
import { formatRecordSequenceValue, nextRecordSequenceValue } from '../schema/recordSequence';

export interface WriteCall {
  tenantId: string;
  collection: string;
  id?: string;
  data?: Record<string, unknown>;
  sequences?: RecordSequenceEntry[];
}

/**
 * O repositório de gravação em memória: reservas de chave com a trava do `create`, contadores de
 * sequência e as chamadas registradas — o que os testes do `runWorkflowUpsert` e da importação conferem.
 */
export class FakeMutationRepository implements IWorkflowMutationRepository {
  store = new Map<string, Record<string, unknown>>();
  /** As reservas, pelo id — o mesmo papel de `tenants/{id}/recordKeys` no Firestore. */
  keys = new Map<string, { keyName: string; recordId: string; values: string[] }>();
  /** Os contadores, pelo id — o papel de `tenants/{id}/recordSequences`. */
  counters = new Map<string, number>();
  createCalls: WriteCall[] = [];
  updateCalls: WriteCall[] = [];
  deleteCalls: WriteCall[] = [];
  private seq = 0;

  private key(collection: string, id: string): string {
    return `${collection}/${id}`;
  }

  seed(collection: string, id: string, data: Record<string, unknown>): void {
    this.store.set(this.key(collection, id), data);
  }

  /** Semeia uma reserva já ocupada — é assim que a duplicata é montada no teste. */
  seedKey(keyId: string, recordId: string, keyName = 'k', values: string[] = []): void {
    this.keys.set(keyId, { keyName, recordId, values });
  }

  async getById(_tenantId: string, collection: string, id: string) {
    return this.store.get(this.key(collection, id)) ?? null;
  }

  newId(): string {
    return `gen-${(this.seq += 1)}`;
  }

  async findKeyHolders(_tenantId: string, keyIds: readonly string[]) {
    const holders = new Map<string, string>();
    for (const keyId of keyIds) {
      const held = this.keys.get(keyId);
      if (held) holders.set(keyId, held.recordId);
    }
    return holders;
  }

  /**
   * A trava do backend é `create`, que FALHA se o documento já existe. O fake reproduz isso e mais
   * nada: é a única propriedade do Firestore de que a corretude depende aqui.
   */
  private applyKeys(recordId: string, keys?: RecordKeyMutation): void {
    for (const keyId of keys?.release ?? []) this.keys.delete(keyId);
    for (const reservation of keys?.create ?? []) {
      if (this.keys.has(reservation.keyId)) {
        throw new RecordKeyTakenError(reservation.keyName, reservation.values);
      }
      this.keys.set(reservation.keyId, {
        keyName: reservation.keyName,
        recordId,
        values: reservation.values,
      });
    }
  }

  async create(
    tenantId: string,
    collection: string,
    data: Record<string, unknown>,
    id?: string,
    keys?: RecordKeyMutation,
    sequences: RecordSequenceEntry[] = [],
  ) {
    const finalId = id ?? this.newId();
    this.applyKeys(finalId, keys);
    const assigned: Record<string, unknown> = {};
    for (const entry of sequences) {
      const value = nextRecordSequenceValue(this.counters.get(entry.counterId));
      this.counters.set(entry.counterId, value);
      assigned[entry.field] = formatRecordSequenceValue(entry, value);
    }
    this.createCalls.push({ tenantId, collection, id, data, sequences });
    this.store.set(this.key(collection, finalId), { ...data, ...assigned });
    return finalId;
  }

  async update(
    tenantId: string,
    collection: string,
    id: string,
    data: Record<string, unknown>,
    keys?: RecordKeyMutation,
  ) {
    this.applyKeys(id, keys);
    this.updateCalls.push({ tenantId, collection, id, data });
    const current = this.store.get(this.key(collection, id)) ?? {};
    this.store.set(this.key(collection, id), { ...current, ...data });
  }

  async delete(tenantId: string, collection: string, id: string, releaseKeyIds?: string[]) {
    this.deleteCalls.push({ tenantId, collection, id });
    this.store.delete(this.key(collection, id));
    for (const keyId of releaseKeyIds ?? []) this.keys.delete(keyId);
  }
}
