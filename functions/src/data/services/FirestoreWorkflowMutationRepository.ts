import { Timestamp } from 'firebase-admin/firestore';
import type {
  CollectionReference,
  DocumentData,
  DocumentReference,
  Firestore,
  Transaction,
} from 'firebase-admin/firestore';
import type {
  IWorkflowMutationRepository,
  RecordKeyMutation,
} from '../../domain/repositories/IWorkflowMutationRepository';
import { RecordKeyTakenError } from '../../domain/repositories/IWorkflowMutationRepository';
import { RECORD_KEYS_COLLECTION } from '../../domain/schema/recordKeys';
import { normalizeFirestoreValue } from '../../domain/services/normalizeFirestoreValue';

const ALREADY_EXISTS = 6;

export class FirestoreWorkflowMutationRepository implements IWorkflowMutationRepository {
  constructor(private readonly db: Firestore) {}

  private collection(tenantId: string, collection: string): CollectionReference<DocumentData> {
    return this.db.collection(`tenants/${tenantId}/${collection}`);
  }

  private keyDoc(tenantId: string, keyId: string): DocumentReference<DocumentData> {
    return this.db.collection(`tenants/${tenantId}/${RECORD_KEYS_COLLECTION}`).doc(keyId);
  }

  /**
   * O Admin SDK IGNORA o `firestore.rules`, então a trava que o front ganha da regra ("`create` só
   * dispara quando o documento não existe") tem de vir de outro lugar aqui. Vem de `tx.create`, que
   * falha com ALREADY_EXISTS se o documento já está lá — dentro de uma transação, portanto sem
   * janela entre conferir e gravar, exatamente como do outro lado.
   *
   * A liberação entra na MESMA transação da criação: soltar antes deixaria o valor livre por um
   * instante; soltar depois, uma falha entre as duas escritas prenderia o valor para sempre.
   */
  private applyKeys(
    tx: Transaction,
    tenantId: string,
    collection: string,
    recordId: string,
    keys: RecordKeyMutation | undefined,
  ): void {
    for (const keyId of keys?.release ?? []) tx.delete(this.keyDoc(tenantId, keyId));
    for (const reservation of keys?.create ?? []) {
      tx.create(this.keyDoc(tenantId, reservation.keyId), {
        collection,
        keyName: reservation.keyName,
        recordId,
        values: reservation.values,
        createdAt: Timestamp.now(),
      });
    }
  }

  /**
   * A transação recusada por ALREADY_EXISTS é sempre uma reserva — é a única escrita aqui que usa
   * `create`. Traduzi-la nomeando a chave é o que faz o passo dizer QUAL valor repetiu, em vez de
   * devolver um código do Firestore para dentro de uma automação.
   */
  private static rethrow(error: unknown, keys: RecordKeyMutation | undefined): never {
    const code = (error as { code?: number | string } | null)?.code;
    const first = keys?.create[0];
    if ((code === ALREADY_EXISTS || code === 'already-exists') && first) {
      throw new RecordKeyTakenError(first.keyName, first.values);
    }
    throw error as Error;
  }

  async getById(
    tenantId: string,
    collection: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    const snapshot = await this.collection(tenantId, collection).doc(id).get();
    return snapshot.exists ? normalizeFirestoreValue(snapshot.data() as Record<string, unknown>) : null;
  }

  newId(tenantId: string, collection: string): string {
    return this.collection(tenantId, collection).doc().id;
  }

  async create(
    tenantId: string,
    collection: string,
    data: Record<string, unknown>,
    id?: string,
    keys?: RecordKeyMutation,
  ): Promise<string> {
    const now = Timestamp.now();
    const payload = { ...data, createdAt: now, updatedAt: now };
    if (!keys || (keys.create.length === 0 && keys.release.length === 0)) {
      if (id) {
        await this.collection(tenantId, collection).doc(id).set(payload);
        return id;
      }
      const ref = await this.collection(tenantId, collection).add(payload);
      return ref.id;
    }

    const recordId = id ?? this.newId(tenantId, collection);
    try {
      await this.db.runTransaction(async (tx) => {
        tx.set(this.collection(tenantId, collection).doc(recordId), payload);
        this.applyKeys(tx, tenantId, collection, recordId, keys);
      });
    } catch (error) {
      FirestoreWorkflowMutationRepository.rethrow(error, keys);
    }
    return recordId;
  }

  async update(
    tenantId: string,
    collection: string,
    id: string,
    data: Record<string, unknown>,
    keys?: RecordKeyMutation,
  ): Promise<void> {
    const payload = { ...data, updatedAt: Timestamp.now() };
    if (!keys || (keys.create.length === 0 && keys.release.length === 0)) {
      await this.collection(tenantId, collection).doc(id).set(payload, { merge: true });
      return;
    }
    try {
      await this.db.runTransaction(async (tx) => {
        tx.set(this.collection(tenantId, collection).doc(id), payload, { merge: true });
        this.applyKeys(tx, tenantId, collection, id, keys);
      });
    } catch (error) {
      FirestoreWorkflowMutationRepository.rethrow(error, keys);
    }
  }

  async delete(
    tenantId: string,
    collection: string,
    id: string,
    releaseKeyIds?: string[],
  ): Promise<void> {
    if (!releaseKeyIds || releaseKeyIds.length === 0) {
      await this.collection(tenantId, collection).doc(id).delete();
      return;
    }
    const batch = this.db.batch();
    batch.delete(this.collection(tenantId, collection).doc(id));
    for (const keyId of releaseKeyIds) batch.delete(this.keyDoc(tenantId, keyId));
    await batch.commit();
  }
}
