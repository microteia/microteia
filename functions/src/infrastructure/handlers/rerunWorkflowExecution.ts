import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { identifyActor } from '../workflow/identifyActor';
import { toPublishedActor } from '../../domain/engine/workflowActor';
import { requirePermission } from './shared/requirePermission';
import { PERMISSION_AUTOMATION_MANAGE } from '../../domain/schema/access';
import { getDb } from '../firebase/initFirebase';
import { workflowEventDocument, workflowEventsRef } from '../../data/services/workflowEventDocument';

interface RerunWorkflowExecutionRequest {
  tenantId: string;
  executionId: string;
}

/**
 * REEXECUTA uma execução: publica de novo o evento que a causou, com a automação dela como ÚNICO alvo.
 *
 * É a resposta ao "falhou porque o serviço estava fora do ar" — sem ela, a única saída era refazer o
 * gesto que gerou o evento (salvar o registro de novo, esperar o próximo horário), e o gesto às vezes
 * não se repete.
 *
 * Republica, e não roda em processo, de propósito: a execução nova passa pela MESMA porta de todas
 * (`onWorkflowEventCreated`), com o orçamento, a condição e os filtros de hoje. O alvo é o mesmo
 * mecanismo do relógio do kernel — o evento acorda só esta automação, nunca as outras que ouvem o
 * mesmo nome —, e é por isso que esta porta é do servidor: o cliente não escreve `target`.
 *
 * Exige `automation.manage`, e não `automation.run`: refazer o passado repete efeitos (um e-mail, um
 * registro gravado), e decidir que eles podem se repetir é de quem administra a automação. O AUTOR da
 * execução nova é quem pediu — e não quem causou a original —, porque é dele o gesto agora.
 */
export const rerunWorkflowExecution = onCall(
  { region: 'southamerica-east1', cors: true },
  async (request): Promise<{ eventId: string }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');
    }

    const { tenantId, executionId } = (request.data ?? {}) as RerunWorkflowExecutionRequest;
    if (!tenantId || !executionId) {
      throw new HttpsError('invalid-argument', '@core.automation/handler.params.missing');
    }

    const permissions = await requirePermission(tenantId, request.auth, PERMISSION_AUTOMATION_MANAGE);
    const db = getDb();

    const execution = await db.doc(`tenants/${tenantId}/workflow_executions/${executionId}`).get();
    if (!execution.exists) {
      throw new HttpsError('not-found', '@core.automation/rerun.execution-missing');
    }
    const { workflowDefinitionId, eventId, status } = execution.data() as {
      workflowDefinitionId?: string;
      eventId?: string;
      status?: string;
    };

    // Uma execução que ainda está correndo ou esperando não terminou — refazê-la agora rodaria a
    // mesma automação duas vezes sobre o mesmo evento, ao mesmo tempo.
    if (status === 'RUNNING' || status === 'WAITING') {
      throw new HttpsError('failed-precondition', '@core.automation/rerun.still-running');
    }
    if (!workflowDefinitionId || !eventId) {
      throw new HttpsError('failed-precondition', '@core.automation/rerun.event-missing');
    }

    const event = await workflowEventsRef(db, tenantId).doc(eventId).get();
    if (!event.exists) {
      throw new HttpsError('failed-precondition', '@core.automation/rerun.event-missing');
    }
    const original = event.data() as { name?: string; payload?: Record<string, unknown> };
    if (!original.name) {
      throw new HttpsError('failed-precondition', '@core.automation/rerun.event-missing');
    }

    const actor = toPublishedActor(await identifyActor(request.auth.uid, 'ui', permissions));
    const ref = await workflowEventsRef(db, tenantId).add(
      workflowEventDocument(original.name, original.payload ?? {}, { actor, target: workflowDefinitionId }),
    );
    return { eventId: ref.id };
  },
);
