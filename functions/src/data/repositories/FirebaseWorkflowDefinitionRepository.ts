import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore, DocumentData } from 'firebase-admin/firestore';
import type { IWorkflowDefinitionRepository } from '../../domain/repositories/IWorkflowDefinitionRepository';
import type { WorkflowDefinition } from '../../domain/entities/Workflow';
import { parseArtifactRef } from '../../domain/schema/plugin/artifactRef';

const toDate = (value: unknown): Date => (value instanceof Timestamp ? value.toDate() : (value as Date));

/**
 * O DONO precisa bater, e não só o `sourceId`.
 *
 * A deduplicação da instalação é por `sourceId` sozinho, sem olhar de quem é: duas extensões sem
 * relação nenhuma que usem `templateId: 'notificar'` já hoje colapsam num documento só. Sem este
 * filtro, `com.a.x/notificar` resolveria para a cópia de `com.c.y` — uma troca de artefato entre
 * extensões, sem sintoma nenhum. O filtro é em memória de propósito: um `array-contains` na mesma
 * consulta pediria índice composto, e a consulta devolve zero ou um documento na prática.
 */
const ownedBy = (owners: string[] | null | undefined, pluginId: string): boolean =>
  Array.isArray(owners) && owners.includes(pluginId);

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
  ownerPluginIds: data.ownerPluginIds ?? null,
  sourceId: data.sourceId ?? null,
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

  async findByRef(tenantId: string, ref: string): Promise<WorkflowDefinition | null> {
    const qualified = parseArtifactRef(ref);
    if (!qualified) return this.findById(tenantId, ref);

    const snap = await this.db
      .collection('tenants')
      .doc(tenantId)
      .collection('workflow_definitions')
      .where('sourceId', '==', qualified.artifactId)
      .get();

    const found = snap.docs
      .map((doc) => mapWorkflowDefinition(doc.id, tenantId, doc.data()))
      .find((definition) => ownedBy(definition.ownerPluginIds, qualified.pluginId));
    return found ?? null;
  }
}
