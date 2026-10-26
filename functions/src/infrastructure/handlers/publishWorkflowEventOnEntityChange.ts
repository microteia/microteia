import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getDb } from '../firebase/initFirebase';
import { getDI } from '../di/container';
import { getWorkflowEventPrefix } from '../../domain/services/workflowEventEntities';
import { publishEvent } from '../workflow/publishEvent';
import { resolveEventPrefix } from '../workflow/resolveEventPrefix';
import { isAggregateBackfillWriteFresh } from '../../domain/services/aggregateBackfill';
import { isRecordKeyBookkeepingWrite } from '../../domain/services/recordKeyAdoption';

/**
 * Publica eventos de entidades com o payload cru do documento:
 * - Todos os campos, na raiz (fixos e declarados pelo tenant, sem distinção)
 * - changeType: 'created' | 'updated' (apenas para .saved)
 * - old: dados antes da alteração (apenas para .saved, ausente na inclusão)
 *
 * FKs NÃO são denormalizadas aqui: a resolução é lazy, feita pelo
 * WorkflowContextHydrator no momento da execução dos workflows, guiada pelos
 * caminhos que cada automação realmente referencia.
 *
 * Suporta as entidades fixas, os lookups e QUALQUER tela do tenant (que emite pelo nome da
 * própria coleção — ver `getWorkflowEventPrefix`).
 */
export const publishWorkflowEventOnEntityChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/{collection}/{docId}', region: 'southamerica-east1' },
  async (event) => {
    const { tenantId, collection, docId } = event.params;
    if (collection === 'screenDefinitions') {
      getDI().getScreenDefinitionCache().invalidate(tenantId);
    }
    const convention = getWorkflowEventPrefix(collection);
    if (!convention) return;

    try {
      // A coleção do registro resolve sem leitura; para as demais, a TELA pode declarar outro
      // prefixo (uma entidade que saiu do kernel mantendo o nome dos eventos). O cache de telas já
      // é carregado pelo motor e tem TTL, então a consulta não custa uma leitura por escrita.
      const prefix = await resolveEventPrefix(tenantId, collection, convention);
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
        // A adoção de uma chave só reserva o valor que o registro já tinha: nada aconteceu a ele.
        if (isRecordKeyBookkeepingWrite(beforeData, afterData)) return;
        // O recálculo dá ao registro o valor que ele já deveria ter: não é fato de negócio, e uma
        // automação de `.saved` rodaria sobre cada registro histórico da coleção.
        const di = getDI();
        const fromBackfill = await isAggregateBackfillWriteFresh(
          tenantId,
          collection,
          beforeData,
          afterData,
          (id) => di.getScreenDefinitionCache().getSchemaContext(id),
          (id) => di.getFreshSchemaContext(id),
        );
        if (fromBackfill) return;
      }

      const eventName = `${prefix}.${isDelete ? 'deleted' : 'saved'}`;
      const referenceData = isDelete ? beforeData : afterData;
      if (!referenceData) return;

      const payload: Record<string, unknown> = { id: docId };

      if (!isDelete) {
        payload.changeType = isCreate ? 'created' : 'updated';
      }

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
