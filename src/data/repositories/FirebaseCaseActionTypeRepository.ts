import { collection, getDocs, orderBy, query, addDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { ICaseActionTypeRepository } from '../../domain/repositories/ICaseActionTypeRepository';
import type { CaseActionTypeConfig } from '../../domain/entities';
import { subscribeLookupCollection } from './subscribeLookupCollection';

export class FirebaseCaseActionTypeRepository implements ICaseActionTypeRepository {
  subscribe(tenantId: string, onChange: (items: CaseActionTypeConfig[]) => void): () => void {
    return subscribeLookupCollection<CaseActionTypeConfig>(tenantId, 'caseActionTypes', [], onChange);
  }

  async getAll(tenantId: string): Promise<CaseActionTypeConfig[]> {
    try {
      const col = collection(db, 'tenants', tenantId, 'caseActionTypes');
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

  async create(tenantId: string, key: string, label: string, createdBy: string): Promise<CaseActionTypeConfig> {
    const col = collection(db, 'tenants', tenantId, 'caseActionTypes');
    await addDoc(col, { key, label, createdBy, createdAt: new Date() });
    return { key, label, isStatic: false };
  }

  async delete(tenantId: string, key: string): Promise<void> {
    const col = collection(db, 'tenants', tenantId, 'caseActionTypes');
    const q = query(col, where('key', '==', key));
    const snap = await getDocs(q);
    const promises = snap.docs.map((d) => deleteDoc(doc(col, d.id)));
    await Promise.all(promises);
  }
}
