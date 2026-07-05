import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';

/**
 * Garante que o StepRegistry esteja populado e que `workflow_step_catalog` reflita os Steps
 * disponíveis. O catálogo só era sincronizado no cold start de `onWorkflowEventCreated`, o que
 * deixa a coleção vazia até o primeiro evento real disparar — travando o builder ("pede um
 * tipo, mas não tem o que escolher"). Chamada pelo client sempre que a tela de Automações abre
 * (ver `WorkflowStore`), tornando a sincronização independente de qualquer evento ter ocorrido.
 */
export const syncWorkflowStepCatalog = onCall(
  { region: 'us-central1', cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    }
    await getDI().ensureWorkflowStepsRegistered();
    return { success: true };
  },
);
