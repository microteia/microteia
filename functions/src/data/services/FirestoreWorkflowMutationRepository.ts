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
import type { RecordSequenceEntry } from '../../domain/schema/recordSequence';
import {
  formatRecordSequenceValue,
  nextRecordSequenceValue,
  RECORD_SEQUENCES_COLLECTION,
  recordSequenceCounterData,
} from '../../domain/schema/recordSequence';
import { normalizeFirestoreValue } from '../../domain/services/normalizeFirestoreValue';
import { getBucket } from '../../infrastructure/firebase/initFirebase';

const ALREADY_EXISTS = 6;

/**
 * As subcoleções que PERTENCEM ao registro, e por isso saem com ele.
 *
 * Elas estão no CAMINHO do registro (`tenants/{t}/{coleção}/{id}/notes`), então nada nelas está
 * denormalizado — e é exatamente por isso que apagar só o documento as deixava inalcançáveis, sem
 * erro em lugar nenhum. Ver `DeleteRecordUseCase`, do lado do cliente, que sempre cascateou.
 */
const OWNED_SUBCOLLECTIONS = ['notes', 'documents'] as const;

/** Quantos documentos de subcoleção por rodada. O Firestore limita o lote a 500 escritas. */
const CASCADE_PAGE = 300;

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

  private sequenceDoc(tenantId: string, counterId: string): DocumentReference<DocumentData> {
    return this.db.collection(`tenants/${tenantId}/${RECORD_SEQUENCES_COLLECTION}`).doc(counterId);
  }

  /**
   * Lê e avança os contadores DENTRO da transação que grava o registro. No Admin SDK a transação
   * trava o que leu: duas criações concorrentes não leem o mesmo valor, e uma criação que falha não
   * avança contador nenhum — o número só existe se o registro existe.
   *
   * Lê tudo antes de escrever qualquer coisa, que é a ordem que a transação do Firestore exige.
   */
  private async advanceSequences(
    tx: Transaction,
    tenantId: string,
    entries: readonly RecordSequenceEntry[],
  ): Promise<Record<string, unknown>> {
    const refs = entries.map((entry) => this.sequenceDoc(tenantId, entry.counterId));
    const snapshots = refs.length > 0 ? await tx.getAll(...refs) : [];
    const assigned: Record<string, unknown> = {};
    entries.forEach((entry, index) => {
      const value = nextRecordSequenceValue(snapshots[index].get('value'));
      assigned[entry.field] = formatRecordSequenceValue(entry, value);
      tx.set(refs[index], { ...recordSequenceCounterData(entry, value), updatedAt: Timestamp.now() });
    });
    return assigned;
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

  async findKeyHolders(tenantId: string, keyIds: readonly string[]): Promise<Map<string, string>> {
    const holders = new Map<string, string>();
    if (keyIds.length === 0) return holders;
    const snapshots = await this.db.getAll(...keyIds.map((keyId) => this.keyDoc(tenantId, keyId)));
    for (const snapshot of snapshots) {
      const recordId = snapshot.exists ? snapshot.get('recordId') : undefined;
      if (typeof recordId === 'string' && recordId !== '') holders.set(snapshot.id, recordId);
    }
    return holders;
  }

  async create(
    tenantId: string,
    collection: string,
    data: Record<string, unknown>,
    id?: string,
    keys?: RecordKeyMutation,
    sequences: RecordSequenceEntry[] = [],
  ): Promise<string> {
    const now = Timestamp.now();
    const payload = { ...data, createdAt: now, updatedAt: now };
    const hasKeys = !!keys && (keys.create.length > 0 || keys.release.length > 0);
    if (!hasKeys && sequences.length === 0) {
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
        const assigned = await this.advanceSequences(tx, tenantId, sequences);
        tx.set(this.collection(tenantId, collection).doc(recordId), { ...payload, ...assigned });
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

  /**
   * Apaga o registro, o que pertence a ele e as reservas de chave que ele citava.
   *
   * A cascata vem ANTES da exclusão do registro, e não depois: se ela falhar no meio, o registro
   * continua lá e uma segunda tentativa termina o serviço. Na ordem inversa, uma falha deixaria
   * anotações e arquivos sem nenhum documento que os alcance — órfãos que ninguém encontra para
   * apagar.
   *
   * Este era o ponto onde o backend divergia do cliente: `DeleteRecordUseCase` sempre cascateou, e o
   * Step "Excluir Registro" apagava só o documento. O defeito não era do agente de IA — ele já
   * existia —, mas é aqui que ele se corrige para as duas superfícies de uma vez.
   */
  async delete(
    tenantId: string,
    collection: string,
    id: string,
    releaseKeyIds?: string[],
  ): Promise<void> {
    const record = this.collection(tenantId, collection).doc(id);
    await this.cascade(record);

    if (!releaseKeyIds || releaseKeyIds.length === 0) {
      await record.delete();
      return;
    }
    const batch = this.db.batch();
    batch.delete(record);
    for (const keyId of releaseKeyIds) batch.delete(this.keyDoc(tenantId, keyId));
    await batch.commit();
  }

  private async cascade(record: DocumentReference): Promise<void> {
    for (const name of OWNED_SUBCOLLECTIONS) {
      // Em páginas porque uma subcoleção não tem teto declarado: um registro com mil anotações não
      // pode virar um lote de mil escritas.
      for (;;) {
        const page = await record.collection(name).limit(CASCADE_PAGE).get();
        if (page.empty) break;

        // O arquivo sai antes do documento que o aponta, pelo mesmo motivo da ordem acima: o
        // `storagePath` é a única forma de encontrá-lo.
        await Promise.all(page.docs.map((doc) => this.removeStoredFile(doc.get('storagePath'))));

        const batch = this.db.batch();
        for (const doc of page.docs) batch.delete(doc.ref);
        await batch.commit();

        if (page.size < CASCADE_PAGE) break;
      }
    }
  }

  /**
   * O arquivo do Storage, quando há um.
   *
   * A falha é registrada e NÃO propaga: um objeto que já não existe (exclusão repetida, ou arquivo
   * removido à mão no console) não pode impedir a exclusão do registro. O contrário — abortar por
   * causa de um arquivo ausente — deixaria o registro para sempre inexcluível.
   */
  private async removeStoredFile(storagePath: unknown): Promise<void> {
    if (typeof storagePath !== 'string' || storagePath === '') return;
    try {
      await getBucket().file(storagePath).delete({ ignoreNotFound: true });
    } catch (error) {
      console.error(`[mutation] Falha ao apagar o arquivo ${storagePath}:`, error);
    }
  }
}
