import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getDI } from '../di/container';
import { getWorkflowEventPrefix } from '../../domain/services/workflowEventEntities';
import { recomputeAggregatesForChildChange } from '../../domain/services/recomputeAggregates';
import { isRecordKeyBookkeepingWrite } from '../../domain/services/recordKeyAdoption';

/**
 * Mantém os campos agregados do PAI em dia quando um registro FILHO muda.
 *
 * Trigger próprio, e não um passo dentro de publishWorkflowEventOnEntityChange, para que uma falha
 * no agregado não derrube a publicação de eventos de workflow (e vice-versa).
 *
 * A cascata termina sozinha porque o recompute é idempotente: sem diferença real no valor, nada é
 * gravado, e sem gravação o `.saved` do pai não dispara. Ciclos entre telas são recusados na autoria.
 */
export const recomputeAggregatesOnEntityChange = onDocumentWritten(
  { document: 'tenants/{tenantId}/{collection}/{docId}', region: 'southamerica-east1' },
  async (event) => {
    const { tenantId, collection, docId } = event.params;
    if (!getWorkflowEventPrefix(collection)) return;

    try {
      const before = event.data?.before;
      const after = event.data?.after;
      const beforeData = before?.exists ? (before.data() as Record<string, unknown>) : null;
      const afterData = after?.exists ? (after.data() as Record<string, unknown>) : null;
      if (!beforeData && !afterData) return;
      if (isRecordKeyBookkeepingWrite(beforeData, afterData)) return;

      await recomputeAggregatesForChildChange(
        tenantId,
        collection,
        beforeData,
        afterData,
        getDI().getAggregateRecomputeDeps(),
      );
    } catch (error) {
      console.error(`[aggregate] Falha ao recalcular agregados de ${tenantId}/${collection}/${docId}:`, error);
    }
  },
);
