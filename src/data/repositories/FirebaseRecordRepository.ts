import {
  addDoc,
  collection as firestoreCollection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IRecordRepository } from '../../domain/repositories/IRecordRepository';
import type { EntityRecord, EntityRecordValues } from '../../domain/entities/EntityRecord';
import type { DeletionActor } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';
import { applyRecordRules, loadRecordBaseline } from '../utils/recordRulesGate';

const RECORDS_PAGE_LIMIT = 500;

const toDate = (v: unknown): Date => (v instanceof Timestamp ? v.toDate() : (v as Date));

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

/**
 * Um campo de data chega do Firestore como Timestamp. Como a coleção não tem mapper escrito à mão,
 * a conversão é genérica e recursiva — nada acima desta camada precisa conhecer o tipo do Firestore.
 */
const toPlainValues = (value: unknown): unknown => {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(toPlainValues);
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toPlainValues(item)]));
  }
  return value;
};

const recordsRef = (tenantId: string, collection: string) =>
  firestoreCollection(db, 'tenants', tenantId, collection);

/**
 * Os campos vêm da raiz do documento, sem desempacotamento. `tenantId` e `collection` são de
 * memória — reconstruídos do caminho lido, nunca gravados.
 */
const mapRecord = (
  id: string,
  d: Record<string, unknown>,
  tenantId: string,
  collection: string,
): EntityRecord => ({
  ...(toPlainValues(d) as Record<string, unknown>),
  id,
  tenantId,
  collection,
  createdAt: toDate(d.createdAt),
  createdBy: (d.createdBy as string | undefined) ?? '',
  createdByName: d.createdByName as string | undefined,
  createdByPhotoURL: d.createdByPhotoURL as string | undefined,
  updatedAt: toDate(d.updatedAt),
  updatedBy: d.updatedBy as string | undefined,
  updatedByName: d.updatedByName as string | undefined,
  updatedByPhotoURL: d.updatedByPhotoURL as string | undefined,
});

/** Metadados de memória nunca chegam ao Firestore. */
const stripIdentity = (data: EntityRecordValues): Record<string, unknown> => {
  const { id, tenantId, collection, createdAt, updatedAt, ...rest } = data as Record<string, unknown>;
  void id;
  void tenantId;
  void collection;
  void createdAt;
  void updatedAt;
  return rest;
};

export class FirebaseRecordRepository implements IRecordRepository {
  async getAll(tenantId: string, collection: string): Promise<EntityRecord[]> {
    const q = query(recordsRef(tenantId, collection), orderBy('createdAt', 'desc'), limit(RECORDS_PAGE_LIMIT));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapRecord(d.id, d.data(), tenantId, collection));
  }

  subscribe(
    tenantId: string,
    collection: string,
    onUpdate: (records: EntityRecord[]) => void,
  ): () => void {
    const q = query(recordsRef(tenantId, collection), orderBy('createdAt', 'desc'), limit(RECORDS_PAGE_LIMIT));
    return onSnapshot(
      q,
      (snap) => {
        onUpdate(snap.docs.map((d) => mapRecord(d.id, d.data(), tenantId, collection)));
      },
      (error) => {
        console.error(`[RecordRepository] subscribe ${collection}:`, error.message);
      },
    );
  }

  async getById(tenantId: string, collection: string, recordId: string): Promise<EntityRecord | null> {
    const snap = await getDoc(doc(recordsRef(tenantId, collection), recordId));
    if (!snap.exists()) return null;
    return mapRecord(snap.id, snap.data(), tenantId, collection);
  }

  async create(tenantId: string, collection: string, data: EntityRecordValues): Promise<EntityRecord> {
    const ref = await addDoc(recordsRef(tenantId, collection), {
      ...applyRecordRules(collection, stripIdentity(data)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return mapRecord(ref.id, snap.data() as Record<string, unknown>, tenantId, collection);
  }

  async update(
    tenantId: string,
    collection: string,
    recordId: string,
    data: EntityRecordValues,
  ): Promise<void> {
    const ref = doc(recordsRef(tenantId, collection), recordId);
    const baseline = await loadRecordBaseline(collection, ref);
    await updateDoc(ref, {
      ...applyRecordRules(collection, stripIdentity(data), baseline),
      updatedAt: serverTimestamp(),
    });
  }

  async delete(
    tenantId: string,
    collection: string,
    recordId: string,
    actor: DeletionActor,
  ): Promise<void> {
    const ref = doc(recordsRef(tenantId, collection), recordId);
    await stampDeletionActor(ref, actor);
    await deleteDoc(ref);
  }

  async hasRecords(tenantId: string, collection: string): Promise<boolean> {
    const snap = await getDocs(query(recordsRef(tenantId, collection), limit(1)));
    return !snap.empty;
  }
}
