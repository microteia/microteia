import {
  addDoc,
  collection,
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
  where,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { ICustomRecordRepository } from '../../domain/repositories/ICustomRecordRepository';
import type { CustomFieldValue, CustomRecord, DeletionActor } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';
import { applyRecordRules, loadRecordBaseline } from '../utils/recordRulesGate';

const toDate = (v: unknown): Date =>
  v instanceof Timestamp ? v.toDate() : (v as Date);

const recordsRef = (tenantId: string) =>
  collection(db, 'tenants', tenantId, 'customRecords');

const mapCustomRecord = (id: string, d: Record<string, unknown>, tenantId: string): CustomRecord => ({
  id,
  tenantId,
  screenKey: d.screenKey as string,
  title: (d.title as string | undefined) ?? '',
  values: (d.values as Record<string, CustomFieldValue> | undefined) ?? {},
  tagIds: (d.tagIds as string[] | undefined) ?? [],
  createdAt: toDate(d.createdAt),
  createdBy: (d.createdBy as string | undefined) ?? '',
  updatedAt: toDate(d.updatedAt),
  updatedBy: d.updatedBy as string | undefined,
  updatedByName: d.updatedByName as string | undefined,
  updatedByPhotoURL: d.updatedByPhotoURL as string | undefined,
});

export class FirebaseCustomRecordRepository implements ICustomRecordRepository {
  async getByScreen(tenantId: string, screenKey: string): Promise<CustomRecord[]> {
    const q = query(
      recordsRef(tenantId),
      where('screenKey', '==', screenKey),
      orderBy('createdAt', 'desc'),
      limit(500),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapCustomRecord(d.id, d.data(), tenantId));
  }

  subscribeByScreen(tenantId: string, screenKey: string, onUpdate: (records: CustomRecord[]) => void): () => void {
    const q = query(
      recordsRef(tenantId),
      where('screenKey', '==', screenKey),
      orderBy('createdAt', 'desc'),
      limit(500),
    );
    return onSnapshot(
      q,
      (snap) => {
        onUpdate(snap.docs.map((d) => mapCustomRecord(d.id, d.data(), tenantId)));
      },
      (error) => {
        console.error('[CustomRecordRepository] subscribeByScreen:', error.message);
      },
    );
  }

  async getById(tenantId: string, recordId: string): Promise<CustomRecord | null> {
    const snap = await getDoc(doc(recordsRef(tenantId), recordId));
    if (!snap.exists()) return null;
    return mapCustomRecord(snap.id, snap.data(), tenantId);
  }

  async create(tenantId: string, data: Omit<CustomRecord, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<CustomRecord> {
    const ref = await addDoc(recordsRef(tenantId), {
      ...applyRecordRules(data.screenKey, data),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return mapCustomRecord(ref.id, snap.data() as Record<string, unknown>, tenantId);
  }

  async update(tenantId: string, recordId: string, screenKey: string, data: Partial<Omit<CustomRecord, 'id' | 'tenantId' | 'screenKey' | 'createdAt' | 'createdBy'>>): Promise<void> {
    const ref = doc(recordsRef(tenantId), recordId);
    const baseline = await loadRecordBaseline(screenKey, ref);
    await updateDoc(ref, {
      ...applyRecordRules(screenKey, data, baseline),
      updatedAt: serverTimestamp(),
    });
  }

  async delete(tenantId: string, recordId: string, actor: DeletionActor): Promise<void> {
    const ref = doc(recordsRef(tenantId), recordId);
    await stampDeletionActor(ref, actor);
    await deleteDoc(ref);
  }

  async hasRecords(tenantId: string, screenKey: string): Promise<boolean> {
    const q = query(recordsRef(tenantId), where('screenKey', '==', screenKey), limit(1));
    const snap = await getDocs(q);
    return !snap.empty;
  }
}
