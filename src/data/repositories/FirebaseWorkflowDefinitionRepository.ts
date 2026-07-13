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
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../infrastructure/firebase/config';
import type { IWorkflowDefinitionRepository, CopyPublicWorkflowResult } from '../../domain/repositories/IWorkflowDefinitionRepository';
import type { WorkflowDefinition, WorkflowParameter, WorkflowStep, PublicWorkflow } from '../../domain/entities/Workflow';

const toDate = (v: unknown): Date => (v instanceof Timestamp ? v.toDate() : (v as Date));

const definitionsRef = (tenantId: string) =>
  collection(db, 'tenants', tenantId, 'workflow_definitions');

const publicWorkflowsRef = () => collection(db, 'public_workflows');

const mapDefinition = (id: string, d: Record<string, unknown>, tenantId: string): WorkflowDefinition => ({
  id,
  tenantId,
  name: d.name as string,
  description: (d.description as string | undefined) ?? undefined,
  eventName: d.eventName as string,
  screenKey: (d.screenKey as string | undefined) ?? undefined,
  lookupCollection: (d.lookupCollection as string | undefined) ?? undefined,
  parameters: (d.parameters as WorkflowParameter[] | undefined) ?? undefined,
  isPublic: (d.isPublic as boolean | undefined) ?? false,
  enabled: (d.enabled as boolean) ?? false,
  version: (d.version as number) ?? 1,
  condition: (d.condition as WorkflowDefinition['condition']) ?? { kind: 'AlwaysTrue' },
  steps: (d.steps as WorkflowStep[]) ?? [],
  createdAt: toDate(d.createdAt),
  updatedAt: toDate(d.updatedAt),
});

const mapPublicWorkflow = (id: string, d: Record<string, unknown>): PublicWorkflow => ({
  id,
  originalWorkflowId: d.originalWorkflowId as string,
  originalTenantId: d.originalTenantId as string,
  ownerId: d.ownerId as string,
  ownerName: d.ownerName as string,
  ownerPhotoURL: (d.ownerPhotoURL as string | undefined) ?? undefined,
  name: d.name as string,
  description: (d.description as string | undefined) ?? undefined,
  eventName: d.eventName as string,
  screenKey: (d.screenKey as string | undefined) ?? undefined,
  lookupCollection: (d.lookupCollection as string | undefined) ?? undefined,
  parameters: (d.parameters as WorkflowParameter[] | undefined) ?? undefined,
  isPublic: true,
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

  subscribeToPublicWorkflowDefinitions(onUpdate: (definitions: PublicWorkflow[]) => void): () => void {
    const q = query(
      publicWorkflowsRef(),
      orderBy('name', 'asc'),
      limit(500),
    );
    return onSnapshot(
      q,
      (snap) => onUpdate(snap.docs.map((d) => mapPublicWorkflow(d.id, d.data()))),
      (error) => console.error('[WorkflowDefinitionRepository] subscribeToPublicWorkflowDefinitions:', error.message),
    );
  }

  async copyPublicWorkflowDefinition(
    originalWorkflowId: string,
    targetTenantId: string,
  ): Promise<CopyPublicWorkflowResult> {
    const copyPublicWorkflowFn = httpsCallable<
      { originalWorkflowId: string; targetTenantId: string },
      CopyPublicWorkflowResult
    >(functions, 'copyPublicWorkflow');

    const result = await copyPublicWorkflowFn({
      originalWorkflowId,
      targetTenantId,
    });

    return result.data;
  }
}
