import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getDb } from '../firebase/initFirebase';
import { getDI } from '../di/container';
import { getWorkflowEventPrefix } from '../../domain/services/workflowEventEntities';
import { publishEvent } from '../workflow/publishEvent';
import { FkEnricher } from '../workflow/FkEnricher';
import { CUSTOM_FIELD_ENABLED_ENTITIES } from '../../domain/entities/entitySchemas';
import type { FieldDefinition } from '../../domain/entities/entitySchemas';

/**
 * Publica eventos de entidades com payload completo e FKs enriquecidas:
 * - Campos estáticos e dinâmicos (customValues.xxx)
 * - old: dados antes da alteração (apenas para .saved)
 * - FKs denormalizadas automaticamente (campos fixos + customizados)
 *
 * Suporta: persons, cases, contracts, deadlines, financials, pushes, news, custom_records e lookups
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

      const db = getDb();
      const enricher = new FkEnricher(db, tenantId);

      let screenDefinition: { fields: FieldDefinition[] } | undefined;
      if (CUSTOM_FIELD_ENABLED_ENTITIES.has(collection)) {
        const screen = await getDI().getScreenDefinitionCache().getScreen(tenantId, collection);
        if (screen) {
          screenDefinition = { fields: screen.fields };
        }
      }

      const enrichedPayload = await enricher.enrichPayload(collection, payload, screenDefinition);

      await publishEvent(db, tenantId, eventName, enrichedPayload);
    } catch (error) {
      console.error(`[workflow] Falha ao publicar evento para ${tenantId}/${collection}/${docId}:`, error);
    }
  },
);
