import { collection, getDocs, orderBy, query, addDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { ICaseStatusRepository } from '../../domain/repositories/ICaseStatusRepository';
import type { CaseStatusConfig } from '../../domain/entities';

const DEFAULT_CASE_STATUSES: CaseStatusConfig[] = [
  { key: 'Em Andamento',          label: 'Em Andamento',          color: 'caseStatusInProgress',  isStatic: true },
  { key: 'Procedente',            label: 'Procedente',            color: 'caseStatusWon',         isStatic: true },
  { key: 'Procedente em Parte',   label: 'Procedente em Parte',   color: 'caseStatusWon',         isStatic: true },
  { key: 'Improcedente',          label: 'Improcedente',          color: 'caseStatusLost',        isStatic: true },
  { key: 'Acordo',                label: 'Acordo',                color: 'caseStatusSettlement',  isStatic: true },
  { key: 'Arquivado',             label: 'Arquivado',             color: 'caseStatusArchived',    isStatic: true },
  { key: 'Suspenso',              label: 'Suspenso',              color: 'caseStatusSuspended',   isStatic: true },
  { key: 'Extinto',               label: 'Extinto',               color: 'caseStatusLost',        isStatic: true },
  { key: 'Rejeitado',             label: 'Rejeitado',             color: 'caseStatusArchived',    isStatic: true },
];

export class FirebaseCaseStatusRepository implements ICaseStatusRepository {
  async getAll(tenantId: string): Promise<CaseStatusConfig[]> {
    try {
      const col = collection(db, 'tenants', tenantId, 'caseStatuses');
      const q = query(col, orderBy('label', 'asc'));
      const snap = await getDocs(q);
      const dynamicStatuses = snap.docs.map((d) => ({
        key:      d.data().key   as string,
        label:    d.data().label as string,
        color:    d.data().color as string,
        isStatic: false,
      }));
      const dynamicKeys = new Set(dynamicStatuses.map((s) => s.key));
      const staticStatuses = DEFAULT_CASE_STATUSES.filter((s) => !dynamicKeys.has(s.key));
      return [...staticStatuses, ...dynamicStatuses].sort((a, b) => a.label.localeCompare(b.label));
    } catch {
      return DEFAULT_CASE_STATUSES;
    }
  }

  async create(tenantId: string, key: string, label: string, color: string, createdBy: string): Promise<CaseStatusConfig> {
    const col = collection(db, 'tenants', tenantId, 'caseStatuses');
    await addDoc(col, { key, label, color, createdBy, createdAt: new Date() });
    return { key, label, color, isStatic: false };
  }

  async delete(tenantId: string, key: string): Promise<void> {
    const col = collection(db, 'tenants', tenantId, 'caseStatuses');
    const q = query(col, where('key', '==', key));
    const snap = await getDocs(q);
    const promises = snap.docs.map((d) => deleteDoc(doc(col, d.id)));
    await Promise.all(promises);
  }
}
