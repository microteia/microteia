import { collection, getDocs, orderBy, query, addDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { ICaseAreaRepository } from '../../domain/repositories/ICaseAreaRepository';
import type { CaseAreaConfig } from '../../domain/entities';
import { mergeLookupDefaults } from './mergeLookupDefaults';

const DEFAULT_CASE_AREAS: CaseAreaConfig[] = [
  { key: 'Cível', label: 'Cível', isStatic: true },
  { key: 'Criminal', label: 'Criminal', isStatic: true },
  { key: 'Trabalhista', label: 'Trabalhista', isStatic: true },
  { key: 'Tributário', label: 'Tributário', isStatic: true },
  { key: 'Família', label: 'Família', isStatic: true },
  { key: 'Consumidor', label: 'Consumidor', isStatic: true },
  { key: 'Administrativo', label: 'Administrativo', isStatic: true },
  { key: 'Constitucional', label: 'Constitucional', isStatic: true },
  { key: 'Ambiental', label: 'Ambiental', isStatic: true },
  { key: 'Imobiliário', label: 'Imobiliário', isStatic: true },
  { key: 'Empresarial', label: 'Empresarial', isStatic: true },
  { key: 'Digital', label: 'Digital', isStatic: true },
  { key: 'Outros', label: 'Outros', isStatic: true },
];

export class FirebaseCaseAreaRepository implements ICaseAreaRepository {
  async getAll(tenantId: string): Promise<CaseAreaConfig[]> {
    try {
      const col = collection(db, 'tenants', tenantId, 'caseAreas');
      const q = query(col, orderBy('label', 'asc'));
      const snap = await getDocs(q);
      const dynamicAreas = snap.docs.map((d) => ({
        key:      d.data().key   as string,
        label:    d.data().label as string,
        isStatic: false,
      }));
      return mergeLookupDefaults(DEFAULT_CASE_AREAS, dynamicAreas);
    } catch {
      return DEFAULT_CASE_AREAS;
    }
  }

  async create(tenantId: string, key: string, label: string, createdBy: string): Promise<CaseAreaConfig> {
    const col = collection(db, 'tenants', tenantId, 'caseAreas');
    await addDoc(col, { key, label, createdBy, createdAt: new Date() });
    return { key, label, isStatic: false };
  }

  async delete(tenantId: string, key: string): Promise<void> {
    const col = collection(db, 'tenants', tenantId, 'caseAreas');
    const q = query(col, where('key', '==', key));
    const snap = await getDocs(q);
    const promises = snap.docs.map((d) => deleteDoc(doc(col, d.id)));
    await Promise.all(promises);
  }
}
