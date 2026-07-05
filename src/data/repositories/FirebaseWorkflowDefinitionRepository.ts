import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IWorkflowDefinitionRepository } from '../../domain/repositories/IWorkflowDefinitionRepository';
import type { WorkflowDefinition, WorkflowStep } from '../../domain/entities/Workflow';

const toDate = (v: unknown): Date => (v instanceof Timestamp ? v.toDate() : (v as Date));

const definitionsRef = (tenantId: string) =>
  collection(db, 'tenants', tenantId, 'workflow_definitions');

const mapDefinition = (id: string, d: Record<string, unknown>, tenantId: string): WorkflowDefinition => ({
  id,
  tenantId,
  name: d.name as string,
  description: (d.description as string | undefined) ?? undefined,
  eventName: d.eventName as string,
  enabled: (d.enabled as boolean) ?? false,
  version: (d.version as number) ?? 1,
  condition: (d.condition as WorkflowDefinition['condition']) ?? { kind: 'AlwaysTrue' },
  steps: (d.steps as WorkflowStep[]) ?? [],
  createdAt: toDate(d.createdAt),
  updatedAt: toDate(d.updatedAt),
});

export class FirebaseWorkflowDefinitionRepository implements IWorkflowDefinitionRepository {
  async getWorkflowDefinitions(tenantId: string): Promise<WorkflowDefinition[]> {
    const q = query(definitionsRef(tenantId), orderBy('name', 'asc'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map((d) => mapDefinition(d.id, d.data(), tenantId));
  }

  subscribeToWorkflowDefinitions(tenantId: string, onUpdate: (definitions: WorkflowDefinition[]) => void): () => void {
    const q = query(definitionsRef(tenantId), orderBy('name', 'asc'), limit(500));
    return onSnapshot(
      q,
      (snap) => onUpdate(snap.docs.map((d) => mapDefinition(d.id, d.data(), tenantId))),
      (error) => console.error('[WorkflowDefinitionRepository] subscribeToWorkflowDefinitions:', error.message),
    );
  }

  async getWorkflowDefinitionById(tenantId: string, id: string): Promise<WorkflowDefinition | null> {
    const snap = await getDoc(doc(definitionsRef(tenantId), id));
    if (!snap.exists()) return null;
    return mapDefinition(snap.id, snap.data(), tenantId);
  }

  async createWorkflowDefinition(
    tenantId: string,
    data: Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>,
  ): Promise<WorkflowDefinition> {
    const ref = await addDoc(definitionsRef(tenantId), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(ref);
    return mapDefinition(ref.id, snap.data() as Record<string, unknown>, tenantId);
  }

  async updateWorkflowDefinition(
    tenantId: string,
    id: string,
    data: Partial<Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt'>>,
  ): Promise<void> {
    await updateDoc(doc(definitionsRef(tenantId), id), { ...data, updatedAt: serverTimestamp() });
  }

  async updateWorkflowSteps(tenantId: string, id: string, steps: WorkflowStep[]): Promise<void> {
    await updateDoc(doc(definitionsRef(tenantId), id), { steps, updatedAt: serverTimestamp() });
  }

  async deleteWorkflowDefinition(tenantId: string, id: string): Promise<void> {
    await deleteDoc(doc(definitionsRef(tenantId), id));
  }
}
