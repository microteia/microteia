import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getDI } from '../di/container';
import type { WorkflowEvent } from '../../domain/entities/Workflow';
import { normalizeFirestoreValue } from '../../domain/services/normalizeFirestoreValue';
import { actorFromPublished } from '../../domain/engine/workflowActor';

/**
 * Escuta a criação de documentos em `tenants/{tenantId}/workflow_events/{eventId}` — o Event
 * Bus do Workflow Engine. Qualquer módulo publica um evento gravando aqui (via
 * `publishEvent()`); esta function é a única assinante e nunca conhece quem publicou.
 * Modelada sobre o mesmo formato de `auditFlatEntityChange`: nunca deixa uma exceção escapar
 * da trigger, cada workflow tem seu próprio isolamento de falha.
 */
export const onWorkflowEventCreated = onDocumentCreated(
  { document: 'tenants/{tenantId}/workflow_events/{eventId}', region: 'southamerica-east1' },
  async (rawEvent) => {
    const { tenantId, eventId } = rawEvent.params;
    const snapshot = rawEvent.data;
    if (!snapshot) return;

    try {
      const data = snapshot.data();
      const workflowEvent: WorkflowEvent = {
        id: eventId,
        tenantId,
        name: data.name,
        payload: normalizeFirestoreValue(data.payload ?? {}),
        timestamp: data.timestamp?.toDate?.() ?? new Date(),
        ...(typeof data.target === 'string' && data.target ? { target: data.target } : {}),
      };

      await getDI().ensureWorkflowStepsRegistered();
      await getDI().getRunWorkflowsForEventUseCase().execute(workflowEvent, actorFromPublished(data.actor));
    } catch (error) {
      console.error(`[workflow] Falha ao processar evento ${tenantId}/${eventId}:`, error);
    }
  },
);
