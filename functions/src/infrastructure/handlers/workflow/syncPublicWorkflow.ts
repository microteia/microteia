import { onDocumentWritten, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { getDb } from '../../firebase/initFirebase';

/**
 * Sincroniza workflows públicos para a coleção public_workflows no root.
 * Quando um workflow é criado/atualizado com isPublic=true, replica para public_workflows.
 * Quando isPublic se torna false ou o workflow é excluído, remove de public_workflows.
 */
export const syncPublicWorkflowOnWrite = onDocumentWritten(
  {
    document: 'tenants/{tenantId}/workflow_definitions/{workflowId}',
    region: 'southamerica-east1',
  },
  async (event) => {
    const { tenantId, workflowId } = event.params;
    const db = getDb();

    const before = event.data?.before;
    const after = event.data?.after;
    const beforeExists = before?.exists ?? false;
    const afterExists = after?.exists ?? false;

    if (!beforeExists && !afterExists) return;

    const beforeData = beforeExists ? (before!.data() as Record<string, unknown>) : null;
    const afterData = afterExists ? (after!.data() as Record<string, unknown>) : null;

    const wasPublic = beforeData?.isPublic === true;
    const isPublic = afterData?.isPublic === true;

    if (isPublic && afterData) {
      const tenantSnap = await db.collection('tenants').doc(tenantId).get();
      const tenantData = tenantSnap.exists ? (tenantSnap.data() as Record<string, unknown>) : null;
      const ownerId = tenantData?.ownerId as string || 'unknown';

      const ownerSnap = await db.collection('users').doc(ownerId).get();
      const ownerData = ownerSnap.exists ? (ownerSnap.data() as Record<string, unknown>) : null;

      await db.collection('public_workflows').doc(workflowId).set({
        originalWorkflowId: workflowId,
        originalTenantId: tenantId,
        ownerId,
        ownerName: ownerData?.displayName || tenantData?.name || 'Desconhecido',
        ownerPhotoURL: ownerData?.photoURL || null,
        name: afterData.name,
        description: afterData.description || null,
        eventName: afterData.eventName,
        screenKey: afterData.screenKey || null,
        lookupCollection: afterData.lookupCollection || null,
        parameters: afterData.parameters || null,
        isPublic: true,
        enabled: afterData.enabled ?? false,
        version: afterData.version ?? 1,
        condition: afterData.condition ?? { kind: 'AlwaysTrue' },
        steps: afterData.steps ?? [],
        createdAt: afterData.createdAt,
        updatedAt: afterData.updatedAt,
      });
    } else if (wasPublic && !isPublic) {
      await db.collection('public_workflows').doc(workflowId).delete();
    }
  },
);

export const syncPublicWorkflowOnDelete = onDocumentDeleted(
  {
    document: 'tenants/{tenantId}/workflow_definitions/{workflowId}',
    region: 'southamerica-east1',
  },
  async (event) => {
    const { workflowId } = event.params;
    const db = getDb();

    const before = event.data;
    if (!before?.exists) return;

    const beforeData = before.data() as Record<string, unknown>;
    const wasPublic = beforeData.isPublic === true;

    if (wasPublic) {
      await db.collection('public_workflows').doc(workflowId).delete();
    }
  },
);
