import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getDb } from '../firebase/initFirebase';
import { getDI } from '../di/container';
import { getWorkflowEventPrefix } from '../../domain/services/workflowEventEntities';
import { publishEvent } from '../workflow/publishEvent';

/**
 * Publica eventos de entidades com o payload cru do documento:
 * - Campos estáticos e dinâmicos (customValues/values)
 * - old: dados antes da alteração (apenas para .saved)
 *
 * FKs NÃO são denormalizadas aqui: a resolução é lazy, feita pelo
 * WorkflowContextHydrator no momento da execução dos workflows, guiada pelos
 * caminhos que cada automação realmente referencia.
 *
 * Suporta: persons, cases, contracts, deadlines, financials, pushes, custom_records e lookups
 */
export const publishWorkflowEventOnEntityChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/{collection}/{docId}', region: 'southamerica-east1' },
  async (event) => {
    const { tenantId, collection, docId } = event.params;
    if (collection === 'screenDefinitions') {
      getDI().getScreenDefinitionCache().invalidate(tenantId);
    }
    const prefix = getWorkflowEventPrefix(collection);
    if (!prefix) return;

    try {
      const before = event.data?.before;
      const after = event.data?.after;
      const beforeExists = before?.exists ?? false;
      const afterExists = after?.exists ?? false;
      if (!beforeExists && !afterExists) return;

      const isDelete = beforeExists && !afterExists;
      const isCreate = !beforeExists && afterExists;
      const beforeData = (beforeExists && before) ? (before.data() as Record<string, unknown>) : null;
      const afterData = (afterExists && after) ? (after.data() as Record<string, unknown>) : null;

      if (!isDelete && !isCreate && beforeExists && afterExists) {
        const hasChanges = JSON.stringify(beforeData) !== JSON.stringify(afterData);
        if (!hasChanges) return;
      }

      const eventName = `${prefix}.${isDelete ? 'deleted' : 'saved'}`;
      const referenceData = isDelete ? beforeData : afterData;
      if (!referenceData) return;

      const payload: Record<string, unknown> = { id: docId };

      if (!isDelete && beforeData) {
        payload.old = beforeData;
      }

      Object.assign(payload, referenceData);

      if (prefix === 'lookup') {
        payload.collection = collection;
      }

      await publishEvent(getDb(), tenantId, eventName, payload);
    } catch (error) {
      console.error(`[workflow] Falha ao publicar evento para ${tenantId}/${collection}/${docId}:`, error);
    }
  },
);
