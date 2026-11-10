import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getDI } from '../di/container';
import type { WorkflowEvent } from '../../domain/entities/Workflow';
import { normalizeFirestoreValue } from '../../domain/services/normalizeFirestoreValue';
import { actorFromPublished } from '../../domain/engine/workflowActor';
import { officeSetting } from '../settings/officeSettings';
import {
  WORKFLOW_EVENT_TIMEOUT_CEILING_SECONDS,
  workflowBudgetProperty,
  workflowDeadlineAt,
} from '../../domain/schema/workflowBudget';

/**
 * Escuta a criação de documentos em `tenants/{tenantId}/workflow_events/{eventId}` — o Event
 * Bus do Workflow Engine. Qualquer módulo publica um evento gravando aqui (via
 * `publishEvent()`); esta function é a única assinante e nunca conhece quem publicou.
 * Modelada sobre o mesmo formato de `auditFlatEntityChange`: nunca deixa uma exceção escapar
 * da trigger, cada workflow tem seu próprio isolamento de falha.
 */
export const onWorkflowEventCreated = onDocumentCreated(
  {
    document: 'tenants/{tenantId}/workflow_events/{eventId}',
    region: 'southamerica-east1',
    // O TETO, igual para todo escritório; quanto dele cada um usa é a configuração
    // `automation.budget.eventSeconds`. Ver `workflowBudget.ts`.
    timeoutSeconds: WORKFLOW_EVENT_TIMEOUT_CEILING_SECONDS,
  },
  async (rawEvent) => {
    const startedAt = Date.now();
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
      const budget = await officeSetting(tenantId, workflowBudgetProperty('event'));
      await getDI().getRunWorkflowsForEventUseCase().execute(workflowEvent, actorFromPublished(data.actor), {
        deadlineAt: workflowDeadlineAt('event', startedAt, budget),
      });
    } catch (error) {
      console.error(`[workflow] Falha ao processar evento ${tenantId}/${eventId}:`, error);
    }
  },
);
