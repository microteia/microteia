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
  Timestamp,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IDeadlineRepository } from '../../domain/repositories/IDeadlineRepository';
import type { Deadline, DeadlineStatus, DeletionActor } from '../../domain/entities';
import { stampDeletionActor } from '../utils/stampDeletionActor';
import { applyRecordRules, loadRecordBaseline } from '../utils/recordRulesGate';

const toDate = (v: unknown): Date =>
  v instanceof Timestamp ? v.toDate() : (v as Date);

const toDateOrNull = (v: unknown): Date | null => {
  if (!v) return null;
  return v instanceof Timestamp ? v.toDate() : (v as Date);
};

const deadlinesRef = (tenantId: string) =>
  collection(db, 'tenants', tenantId, 'deadlines');

const mapDeadline = (id: string, d: Record<string, unknown>, tenantId: string): Deadline => ({
  // Campos declarados pelo tenant moram na raiz, ao lado dos fixos: o documento cru
  // entra inteiro e o mapeamento tipado sobrescreve o que precisa de conversão.
  ...d,
  id,
  tenantId,
  caseId: d.caseId as string,
  description: (d.description as string | null) ?? null,
  dueDate: toDate(d.dueDate),
  type: d.type as Deadline['type'],
  priority: (d.priority as Deadline['priority']) ?? 'Média',
  status: (d.status as DeadlineStatus) ?? 'Pendente',
  responsibleLawyerId: (d.responsibleLawyerId as string | null) ?? null,
  completedAt: toDateOrNull(d.completedAt),
  completedBy: (d.completedBy as string | null) ?? null,
  notes: (d.notes as string | null) ?? null,
  pushIds: (d.pushIds as string[]) ?? undefined,
  createdAt: toDate(d.createdAt),
  createdBy: d.createdBy as string,
  updatedAt: toDate(d.updatedAt),
});

export class FirebaseDeadlineRepository implements IDeadlineRepository {
  async getDeadlines(tenantId: string): Promise<Deadline[]> {
    const q = query(deadlinesRef(tenantId), orderBy('dueDate', 'asc'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDeadline(d.id, d.data(), tenantId));
  }

  subscribeToDeadlines(tenantId: string, onUpdate: (deadlines: Deadline[]) => void): () => void {
    const q = query(deadlinesRef(tenantId), orderBy('dueDate', 'asc'), limit(500));
    return onSnapshot(
      q,
      (snap) => {
        onUpdate(snap.docs.map((d) => mapDeadline(d.id, d.data(), tenantId)));
      },
      (error) => {
        console.error('[DeadlineRepository] subscribeToDeadlines:', error.message);
      },
    );
  }

  async getDeadlinesByCase(tenantId: string, caseId: string): Promise<Deadline[]> {
    const q = query(
      deadlinesRef(tenantId),
      where('caseId', '==', caseId),
      orderBy('dueDate', 'asc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDeadline(d.id, d.data(), tenantId));
  }

  async getDeadlineById(tenantId: string, deadlineId: string): Promise<Deadline | null> {
    const snap = await getDoc(doc(deadlinesRef(tenantId), deadlineId));
    if (!snap.exists()) return null;
    return mapDeadline(snap.id, snap.data(), tenantId);
  }

  async createDeadline(tenantId: string, data: Omit<Deadline, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<Deadline> {
    const ref = await addDoc(deadlinesRef(tenantId), {
      ...applyRecordRules('deadlines', data),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return mapDeadline(ref.id, snap.data() as Record<string, unknown>, tenantId);
  }

  async updateDeadline(tenantId: string, deadlineId: string, data: Partial<Omit<Deadline, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>): Promise<void> {
    const ref = doc(deadlinesRef(tenantId), deadlineId);
    const baseline = await loadRecordBaseline('deadlines', ref);
    await updateDoc(ref, {
      ...applyRecordRules('deadlines', data, baseline),
      updatedAt: serverTimestamp(),
    });
  }

  async updateDeadlineStatus(
    tenantId: string,
    deadlineId: string,
    status: DeadlineStatus,
    completedBy?: string,
  ): Promise<void> {
    const payload: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
    if (status === 'Concluído' && completedBy) {
      payload.completedAt = serverTimestamp();
      payload.completedBy = completedBy;
    }
    await updateDoc(doc(deadlinesRef(tenantId), deadlineId), payload);
  }

  async deleteDeadline(tenantId: string, deadlineId: string, actor: DeletionActor): Promise<void> {
    const ref = doc(deadlinesRef(tenantId), deadlineId);
    await stampDeletionActor(ref, actor);
    await deleteDoc(ref);
  }
}
