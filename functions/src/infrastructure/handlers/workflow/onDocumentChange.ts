import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getDb } from '../../firebase/initFirebase';
import { publishEvent } from '../../workflow/publishEvent';

/**
 * Publica eventos de documentos: {entity}_document.saved e {entity}_document.deleted
 *
 * Exemplo: case_document.saved, person_document.saved, contract_document.saved
 *
 * Payload inclui:
 * - id do documento
 * - parentId: id da entidade pai
 * - parentType: tipo da entidade pai
 * - fileName, fileSize, uploadedBy, uploadedAt
 * - old: dados antes (apenas para saved)
 * - parent: dados principais da entidade pai
 */
export const onDocumentChange = onDocumentWritten(
  {
    document: 'tenants/{tenantId}/{parent}/{parentId}/documents/{documentId}',
    region: 'southamerica-east1',
  },
  async (event) => {
    const { tenantId, parent, parentId, documentId } = event.params;

    const allowedParents = ['cases', 'persons', 'contracts', 'financials'];
    if (!allowedParents.includes(parent)) return;

    const before = event.data?.before;
    const after = event.data?.after;
    const beforeExists = before?.exists ?? false;
    const afterExists = after?.exists ?? false;

    if (!beforeExists && !afterExists) return;

    const action = !beforeExists ? 'saved' : !afterExists ? 'deleted' : 'saved';
    const beforeData = (beforeExists && before) ? (before.data() as Record<string, unknown>) : null;
    const afterData = (afterExists && after) ? (after.data() as Record<string, unknown>) : null;

    if (action === 'saved' && beforeExists && afterExists) {
      const hasChanges = JSON.stringify(beforeData) !== JSON.stringify(afterData);
      if (!hasChanges) return;
    }

    const parentTypeSingular = parent.slice(0, -1);
    const eventName = `${parentTypeSingular}_document.${action}`;

    const payload: Record<string, unknown> = {
      id: documentId,
      parentId,
      parentType: parentTypeSingular,
    };

    const referenceData = action === 'deleted' ? beforeData : afterData;
    if (referenceData) {
      if (action === 'saved' && beforeData) {
        payload.old = beforeData;
      }
      Object.assign(payload, referenceData);
    }

    const db = getDb();
    const parentDoc = await db
      .collection('tenants')
      .doc(tenantId)
      .collection(parent)
      .doc(parentId)
      .get();

    if (parentDoc.exists) {
      const parentData = parentDoc.data() as Record<string, unknown>;
      const parentPayload: Record<string, unknown> = { id: parentId };

      if (parent === 'cases') {
        parentPayload.caseNumber = parentData.caseNumber;
        parentPayload.title = parentData.title;
      } else if (parent === 'persons' || parent === 'contracts') {
        parentPayload.name = parentData.name ?? parentData.title;
      } else if (parent === 'financials') {
        parentPayload.type = parentData.type;
        parentPayload.amount = parentData.amount;
      }

      payload.parent = parentPayload;
    }

    await publishEvent(db, tenantId, eventName, payload);
  },
);
