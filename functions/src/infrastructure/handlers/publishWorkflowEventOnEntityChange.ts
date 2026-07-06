import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getDb } from '../firebase/initFirebase';
import { getWorkflowEventPrefix } from '../../domain/services/workflowEventEntities';
import { publishEvent } from '../workflow/publishEvent';

/**
 * Escuta qualquer escrita em `tenants/{tenantId}/{collection}/{docId}` (mesmo escopo de
 * `auditFlatEntityChange`, mas para um propósito diferente) e publica `<entidade>.saved` ou
 * `<entidade>.deleted` no Event Bus do Workflow Engine (`workflow_events`) quando a coleção
 * está no mapa de `getWorkflowEventPrefix` (persons, cases, contracts, deadlines, financials,
 * pushes, customRecords e as coleções de lookup). Nenhum módulo de domínio precisa conhecer o
 * motor — a publicação acontece aqui, de fora, olhando só para a escrita no Firestore.
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
      const eventName = `${prefix}.${isDelete ? 'deleted' : 'saved'}`;
      const referenceData = (isDelete ? before?.data() : after?.data()) as Record<string, unknown> | undefined;

      // "lookup" é um prefixo genérico compartilhado por dezenas de coleções (ver
      // LOOKUP_COLLECTIONS em workflowEventEntities.ts) — o nome da coleção precisa viajar no
      // payload para que o gatilho do Workflow (WorkflowExecutor.lookupCollection) saiba
      // distinguir, por exemplo, "personTypes" de "caseAreas".
      const extra = prefix === 'lookup' ? { collection } : {};

      await publishEvent(getDb(), tenantId, eventName, { id: docId, ...referenceData, ...extra });
    } catch (error) {
      console.error(`[workflow] Falha ao publicar evento para ${tenantId}/${collection}/${docId}:`, error);
    }
  },
);
