import { collection, getDocs, orderBy, query, addDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { ICaseInstanceRepository } from '../../domain/repositories/ICaseInstanceRepository';
import type { CaseInstanceConfig } from '../../domain/entities';

const DEFAULT_CASE_INSTANCES: CaseInstanceConfig[] = [
  { key: '1º Grau', label: '1º Grau', isStatic: true },
  { key: '2º Grau', label: '2º Grau', isStatic: true },
  { key: 'Turma Recursal', label: 'Turma Recursal', isStatic: true },
  { key: 'STJ', label: 'STJ', isStatic: true },
  { key: 'STF', label: 'STF', isStatic: true },
  { key: 'TST', label: 'TST', isStatic: true },
  { key: 'TSE', label: 'TSE', isStatic: true },
];

export class FirebaseCaseInstanceRepository implements ICaseInstanceRepository {
  async getAll(tenantId: string): Promise<CaseInstanceConfig[]> {
    try {
      const col = collection(db, 'tenants', tenantId, 'caseInstances');
      const q = query(col, orderBy('label', 'asc'));
      const snap = await getDocs(q);
      const dynamicInstances = snap.docs.map((d) => ({
        key:      d.data().key   as string,
        label:    d.data().label as string,
        color:    d.data().color as string | undefined,
        isStatic: false,
      }));
      const dynamicKeys = new Set(dynamicInstances.map((i) => i.key));
      const staticInstances = DEFAULT_CASE_INSTANCES.filter((i) => !dynamicKeys.has(i.key));
      return [...staticInstances, ...dynamicInstances].sort((a, b) => a.label.localeCompare(b.label));
    } catch {
      return DEFAULT_CASE_INSTANCES;
    }
  }

  async create(tenantId: string, key: string, label: string, color: string | undefined, createdBy: string): Promise<CaseInstanceConfig> {
    const col = collection(db, 'tenants', tenantId, 'caseInstances');
    const data: Record<string, unknown> = { key, label, createdBy, createdAt: new Date() };
    if (color) data.color = color;
    await addDoc(col, data);
    return { key, label, color };
  }

  async delete(tenantId: string, key: string): Promise<void> {
    const col = collection(db, 'tenants', tenantId, 'caseInstances');
    const q = query(col, where('key', '==', key));
    const snap = await getDocs(q);
    const promises = snap.docs.map((d) => deleteDoc(doc(col, d.id)));
    await Promise.all(promises);
  }
}
