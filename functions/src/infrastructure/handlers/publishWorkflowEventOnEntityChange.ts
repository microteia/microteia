import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getDb } from '../firebase/initFirebase';
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

      // Enriquecimento automático de FKs usando FkEnricher
      const db = getDb();
      const enricher = new FkEnricher(db, tenantId);

      console.log(`[publishWorkflowEvent] Processando ${collection}/${docId} para tenant ${tenantId}`);
      console.log(`[publishWorkflowEvent] Suporta custom fields? ${CUSTOM_FIELD_ENABLED_ENTITIES.has(collection)}`);

      // Carregar ScreenDefinition se a entidade suportar campos customizados
      let screenDefinition: { fields: FieldDefinition[] } | undefined;
      if (CUSTOM_FIELD_ENABLED_ENTITIES.has(collection)) {
        const screenDoc = await db
          .collection('tenants')
          .doc(tenantId)
          .collection('screenDefinitions')
          .doc(collection)
          .get();

        console.log(`[publishWorkflowEvent] ScreenDoc existe? ${screenDoc.exists}`);

        if (screenDoc.exists) {
          const screenData = screenDoc.data();
          console.log(`[publishWorkflowEvent] ScreenData:`, JSON.stringify(screenData, null, 2));
          screenDefinition = {
            fields: (screenData?.fields as FieldDefinition[]) || [],
          };
          console.log(`[publishWorkflowEvent] ScreenDefinition carregado com ${screenDefinition.fields.length} campos`);
        } else {
          console.log(`[publishWorkflowEvent] ScreenDefinition NÃO encontrado para collection="${collection}"`);
        }
      }

      // Enriquecer payload com FKs
      const enrichedPayload = await enricher.enrichPayload(
        collection,
        payload,
        screenDefinition,
      );

      console.log(`[publishWorkflowEvent] Publicando evento "${eventName}" com payload enriquecido`);

      await publishEvent(db, tenantId, eventName, enrichedPayload);
    } catch (error) {
      console.error(`[workflow] Falha ao publicar evento para ${tenantId}/${collection}/${docId}:`, error);
    }
  },
);
