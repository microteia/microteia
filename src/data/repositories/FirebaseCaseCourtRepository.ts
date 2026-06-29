import { collection, getDocs, orderBy, query, addDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { ICaseCourtRepository } from '../../domain/repositories/ICaseCourtRepository';
import type { CaseCourtConfig } from '../../domain/entities';

export class FirebaseCaseCourtRepository implements ICaseCourtRepository {
  async getAll(tenantId: string): Promise<CaseCourtConfig[]> {
    try {
      const col = collection(db, 'tenants', tenantId, 'caseCourts');
      const q = query(col, orderBy('label', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({
        key:      d.data().key   as string,
        label:    d.data().label as string,
        isStatic: false,
      }));
    } catch {
      return [];
    }
  }

  async create(tenantId: string, key: string, label: string, createdBy: string): Promise<CaseCourtConfig> {
    const col = collection(db, 'tenants', tenantId, 'caseCourts');
    await addDoc(col, { key, label, createdBy, createdAt: new Date() });
    return { key, label, isStatic: false };
  }

  async delete(tenantId: string, key: string): Promise<void> {
    const col = collection(db, 'tenants', tenantId, 'caseCourts');
    const q = query(col, where('key', '==', key));
    const snap = await getDocs(q);
    const promises = snap.docs.map((d) => deleteDoc(doc(col, d.id)));
    await Promise.all(promises);
  }
}
