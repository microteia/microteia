import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getDb } from '../firebase/initFirebase';
import { getWorkflowEventPrefix } from '../../domain/services/workflowEventEntities';
import { publishEvent } from '../workflow/publishEvent';

interface DenormConfig {
  fkField: string;
  collection: string;
  outputKey: string;
  fields: string[];
}

const ENTITY_DENORMALIZATIONS: Record<string, DenormConfig[]> = {
  cases: [
    { fkField: 'contractId', collection: 'contracts', outputKey: 'contract', fields: ['number', 'title', 'type', 'status'] },
    { fkField: 'responsibleLawyerId', collection: 'members', outputKey: 'responsibleLawyer', fields: ['name', 'email'] },
  ],
  contracts: [
    { fkField: 'clientId', collection: 'persons', outputKey: 'client', fields: ['name', 'type', 'email'] },
    { fkField: 'responsibleId', collection: 'members', outputKey: 'responsible', fields: ['name', 'email'] },
  ],
  deadlines: [
    { fkField: 'caseId', collection: 'cases', outputKey: 'case', fields: ['caseNumber', 'title', 'area'] },
    { fkField: 'responsibleLawyerId', collection: 'members', outputKey: 'responsibleLawyer', fields: ['name', 'email'] },
  ],
  financials: [
    { fkField: 'caseId', collection: 'cases', outputKey: 'case', fields: ['caseNumber', 'title'] },
    { fkField: 'personId', collection: 'persons', outputKey: 'person', fields: ['name', 'type'] },
    { fkField: 'contractId', collection: 'contracts', outputKey: 'contract', fields: ['number', 'title'] },
  ],
};

/**
 * Publica eventos de entidades com payload completo:
 * - Campos estáticos e dinâmicos (values.xxx)
 * - old: dados antes da alteração (apenas para .saved)
 * - FKs denormalizadas com dados principais
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

      // Normaliza customValues → values para uniformizar API de eventos
      if ('customValues' in payload && payload.customValues) {
        payload.values = payload.customValues;
        delete payload.customValues;
      }

      if (prefix === 'lookup') {
        payload.collection = collection;
      }

      const denormalizations = ENTITY_DENORMALIZATIONS[collection];
      if (denormalizations) {
        const db = getDb();
        for (const config of denormalizations) {
          const fkId = referenceData[config.fkField];
          if (fkId && typeof fkId === 'string') {
            const fkDoc = await db
              .collection('tenants')
              .doc(tenantId)
              .collection(config.collection)
              .doc(fkId)
              .get();

            if (fkDoc.exists) {
              const fkData = fkDoc.data() as Record<string, unknown>;
              const denormalized: Record<string, unknown> = { id: fkDoc.id };
              for (const field of config.fields) {
                if (field in fkData) {
                  denormalized[field] = fkData[field];
                }
              }
              payload[config.outputKey] = denormalized;
            }
          }
        }
      }

      await publishEvent(getDb(), tenantId, eventName, payload);
    } catch (error) {
      console.error(`[workflow] Falha ao publicar evento para ${tenantId}/${collection}/${docId}:`, error);
    }
  },
);
