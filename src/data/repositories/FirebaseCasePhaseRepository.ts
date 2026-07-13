import { collection, getDocs, orderBy, query, addDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { ICasePhaseRepository } from '../../domain/repositories/ICasePhaseRepository';
import type { CasePhaseConfig } from '../../domain/entities';

const DEFAULT_CASE_PHASES: CasePhaseConfig[] = [
  { key: 'Fase Inicial', label: 'Fase Inicial', color: 'casePhaseInitial',     isStatic: true },
  { key: 'Instrução',    label: 'Instrução',    color: 'casePhaseInstruction', isStatic: true },
  { key: 'Sentença',     label: 'Sentença',     color: 'casePhaseSentence',    isStatic: true },
  { key: 'Recurso',      label: 'Recurso',      color: 'casePhaseAppeal',      isStatic: true },
  { key: 'Execução',     label: 'Execução',     color: 'casePhaseExecution',   isStatic: true },
  { key: 'RPV',          label: 'RPV',          color: 'casePhaseExecution',   isStatic: true },
  { key: 'Precatório',   label: 'Precatório',   color: 'casePhaseExecution',   isStatic: true },
  { key: 'Arquivado',    label: 'Arquivado',    color: 'casePhaseArchived',    isStatic: true },
];

export class FirebaseCasePhaseRepository implements ICasePhaseRepository {
  async getAll(tenantId: string): Promise<CasePhaseConfig[]> {
    try {
      const col = collection(db, 'tenants', tenantId, 'casePhases');
      const q = query(col, orderBy('label', 'asc'));
      const snap = await getDocs(q);
      const dynamicPhases = snap.docs.map((d) => ({
        key:      d.data().key   as string,
        label:    d.data().label as string,
        color:    d.data().color as string | undefined,
        isStatic: false,
      }));
      const dynamicKeys = new Set(dynamicPhases.map((p) => p.key));
      const staticPhases = DEFAULT_CASE_PHASES.filter((p) => !dynamicKeys.has(p.key));
      return [...staticPhases, ...dynamicPhases].sort((a, b) => a.label.localeCompare(b.label));
    } catch {
      return DEFAULT_CASE_PHASES;
    }
  }

  async create(tenantId: string, key: string, label: string, color: string | undefined, createdBy: string): Promise<CasePhaseConfig> {
    const col = collection(db, 'tenants', tenantId, 'casePhases');
    const data: Record<string, unknown> = { key, label, createdBy, createdAt: new Date() };
    if (color) data.color = color;
    await addDoc(col, data);
    return { key, label, color, isStatic: false };
  }

  async delete(tenantId: string, key: string): Promise<void> {
    const col = collection(db, 'tenants', tenantId, 'casePhases');
    const q = query(col, where('key', '==', key));
    const snap = await getDocs(q);
    const promises = snap.docs.map((d) => deleteDoc(doc(col, d.id)));
    await Promise.all(promises);
  }
}
