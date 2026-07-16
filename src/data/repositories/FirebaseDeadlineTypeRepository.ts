import { collection, getDocs, orderBy, query, addDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IDeadlineTypeRepository } from '../../domain/repositories/IDeadlineTypeRepository';
import type { DeadlineTypeConfig } from '../../domain/entities';
import { mergeLookupDefaults } from './mergeLookupDefaults';

const DEFAULT_DEADLINE_TYPES: DeadlineTypeConfig[] = [
  { key: 'Audiência',   label: 'Audiência',   isStatic: true },
  { key: 'Recurso',     label: 'Recurso',     isStatic: true },
  { key: 'Contestação', label: 'Contestação', isStatic: true },
  { key: 'Petição',     label: 'Petição',     isStatic: true },
  { key: 'Pagamento',   label: 'Pagamento',   isStatic: true },
  { key: 'Outro',       label: 'Outro',       isStatic: true },
];

export class FirebaseDeadlineTypeRepository implements IDeadlineTypeRepository {
  async getAll(tenantId: string): Promise<DeadlineTypeConfig[]> {
    try {
      const col = collection(db, 'tenants', tenantId, 'deadlineTypes');
      const q = query(col, orderBy('label', 'asc'));
      const snap = await getDocs(q);
      const dynamic = snap.docs.map((d) => ({
        key:      d.data().key   as string,
        label:    d.data().label as string,
        isStatic: false,
      }));
      return mergeLookupDefaults(DEFAULT_DEADLINE_TYPES, dynamic);
    } catch {
      return DEFAULT_DEADLINE_TYPES;
    }
  }

  async create(tenantId: string, key: string, label: string, createdBy: string): Promise<DeadlineTypeConfig> {
    const col = collection(db, 'tenants', tenantId, 'deadlineTypes');
    await addDoc(col, { key, label, createdBy, createdAt: new Date() });
    return { key, label, isStatic: false };
  }

  async delete(tenantId: string, key: string): Promise<void> {
    const col = collection(db, 'tenants', tenantId, 'deadlineTypes');
    const q = query(col, where('key', '==', key));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(doc(col, d.id))));
  }
}
