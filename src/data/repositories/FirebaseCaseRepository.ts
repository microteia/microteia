import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  Timestamp,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { ICaseRepository } from '../../domain/repositories/ICaseRepository';
import type { Case, CaseInstance, CaseStatus, DeletionActor, CustomFieldValue } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';
import { applyRecordRules } from '../utils/recordRulesGate';

const toDate = (v: unknown): Date =>
  v instanceof Timestamp ? v.toDate() : (v as Date);

const toDateOrNull = (v: unknown): Date | null => {
  if (!v) return null;
  return v instanceof Timestamp ? v.toDate() : (v as Date);
};

const casesRef = (tenantId: string) =>
  collection(db, 'tenants', tenantId, 'cases');

const mapCase = (id: string, d: Record<string, unknown>, tenantId: string): Case => ({
  id,
  tenantId,
  caseNumber: d.caseNumber as string,
  title: d.title as string,
  area: d.area as Case['area'],
  type: d.type
    ? (Array.isArray(d.type) ? d.type as string[] : [d.type as string])
    : undefined,
  court: (d.court as string | null) ?? null,
  courtDistrict: (d.courtDistrict as string | null) ?? null,
  judge: (d.judge as string | null) ?? null,
  instance: (d.instance as CaseInstance | undefined) ?? undefined,
  phase: d.phase as Case['phase'],
  status: (d.status as CaseStatus) ?? 'Em Andamento',
  responsibleLawyerId: d.responsibleLawyerId as string,
  contractId: (d.contractId as string | null) ?? null,
  activePoleIds: (d.activePoleIds as string[] | undefined) ?? [],
  passivePoleIds: (d.passivePoleIds as string[] | undefined) ?? [],
  opposingParties: (d.opposingParties as Case['opposingParties']) ?? [],
  filedAt: toDateOrNull(d.filedAt),
  causeValue: (d.causeValue as number | null) ?? null,
  notes: (d.notes as string | null) ?? null,
  tagIds: (d.tagIds as string[] | undefined) ?? [],
  customValues: (d.customValues as Record<string, CustomFieldValue> | undefined) ?? {},
  createdAt: toDate(d.createdAt),
  createdBy: d.createdBy as string,
  updatedAt: toDate(d.updatedAt),
});

export class FirebaseCaseRepository implements ICaseRepository {
  async getCases(tenantId: string): Promise<Case[]> {
    const q = query(casesRef(tenantId), orderBy('createdAt', 'desc'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapCase(d.id, d.data(), tenantId));
  }

  subscribeToCases(tenantId: string, onUpdate: (cases: Case[]) => void): () => void {
    const q = query(casesRef(tenantId), orderBy('createdAt', 'desc'), limit(500));
    return onSnapshot(
      q,
      (snap) => {
        onUpdate(snap.docs.map((d) => mapCase(d.id, d.data(), tenantId)));
      },
      (error) => {
        console.error('[CaseRepository] subscribeToCases:', error.message);
      },
    );
  }

  async getCasesByPerson(tenantId: string, personId: string): Promise<Case[]> {
    const [activeSnap, passiveSnap] = await Promise.all([
      getDocs(query(casesRef(tenantId), where('activePoleIds', 'array-contains', personId))),
      getDocs(query(casesRef(tenantId), where('passivePoleIds', 'array-contains', personId))),
    ]);
    const byId = new Map<string, Case>();
    for (const d of [...activeSnap.docs, ...passiveSnap.docs]) {
      byId.set(d.id, mapCase(d.id, d.data(), tenantId));
    }
    return Array.from(byId.values());
  }

  async getCaseById(tenantId: string, caseId: string): Promise<Case | null> {
    const snap = await getDoc(doc(casesRef(tenantId), caseId));
    if (!snap.exists()) return null;
    return mapCase(snap.id, snap.data(), tenantId);
  }

  async createCase(tenantId: string, data: Omit<Case, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<Case> {
    const ref = await addDoc(casesRef(tenantId), {
      ...applyRecordRules('cases', data),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return mapCase(ref.id, snap.data() as Record<string, unknown>, tenantId);
  }

  async updateCase(tenantId: string, caseId: string, data: Partial<Omit<Case, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>): Promise<void> {
    await updateDoc(doc(casesRef(tenantId), caseId), {
      ...applyRecordRules('cases', data),
      updatedAt: serverTimestamp(),
    });
  }

  async updateCaseStatus(tenantId: string, caseId: string, status: CaseStatus): Promise<void> {
    await updateDoc(doc(casesRef(tenantId), caseId), { status, updatedAt: serverTimestamp() });
  }

  async deleteCase(tenantId: string, caseId: string, actor: DeletionActor): Promise<void> {
    const ref = doc(casesRef(tenantId), caseId);
    await stampDeletionActor(ref, actor);
    await deleteDoc(ref);
  }

  async unlinkCasesFromContract(tenantId: string, contractId: string): Promise<void> {
    const q = query(casesRef(tenantId), where('contractId', '==', contractId));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    for (const d of snap.docs) {
      batch.update(d.ref, { contractId: null, updatedAt: serverTimestamp() });
    }
    await batch.commit();
  }
}
