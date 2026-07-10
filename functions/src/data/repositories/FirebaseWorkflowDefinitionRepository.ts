import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore, DocumentData } from 'firebase-admin/firestore';
import type { IWorkflowDefinitionRepository } from '../../domain/repositories/IWorkflowDefinitionRepository';
import type { WorkflowDefinition } from '../../domain/entities/Workflow';

const toDate = (value: unknown): Date => (value instanceof Timestamp ? value.toDate() : (value as Date));

const mapWorkflowDefinition = (id: string, tenantId: string, data: DocumentData): WorkflowDefinition => ({
  id,
  tenantId,
  name: data.name,
  description: data.description ?? undefined,
  eventName: data.eventName,
  screenKey: data.screenKey ?? undefined,
  lookupCollection: data.lookupCollection ?? undefined,
  parameters: data.parameters ?? undefined,
  enabled: data.enabled ?? false,
  version: data.version ?? 1,
  condition: data.condition ?? { kind: 'AlwaysTrue' },
  steps: data.steps ?? [],
  createdAt: toDate(data.createdAt),
  updatedAt: toDate(data.updatedAt),
});

export class FirebaseWorkflowDefinitionRepository implements IWorkflowDefinitionRepository {
  constructor(private readonly db: Firestore) {}

  async findEnabledByEvent(tenantId: string, eventName: string): Promise<WorkflowDefinition[]> {
    const snap = await this.db
      .collection('tenants')
      .doc(tenantId)
      .collection('workflow_definitions')
      .where('enabled', '==', true)
      .where('eventName', '==', eventName)
      .get();
    return snap.docs.map((doc) => mapWorkflowDefinition(doc.id, tenantId, doc.data()));
  }

  async findById(tenantId: string, id: string): Promise<WorkflowDefinition | null> {
    const snap = await this.db
      .collection('tenants')
      .doc(tenantId)
      .collection('workflow_definitions')
      .doc(id)
      .get();
    if (!snap.exists) return null;
    return mapWorkflowDefinition(snap.id, tenantId, snap.data() as DocumentData);
  }
}
