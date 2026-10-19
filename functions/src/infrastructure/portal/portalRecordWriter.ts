import type { WorkflowContext, WorkflowLogger } from '../../domain/entities/WorkflowContext';
import type { PortalRecordWriter } from '../../domain/usecases/PortalAccessUseCases';
import { runWorkflowUpsert } from '../workflow/mutation/runWorkflowMutation';
import { FirestoreWorkflowMutationRepository } from '../../data/services/FirestoreWorkflowMutationRepository';
import { identifyActor } from '../workflow/identifyActor';
import { tenantTimeZone } from '../settings/tenantTimeZone';
import { tenantBusinessCalendars } from '../settings/tenantBusinessCalendars';
import { getDb } from '../firebase/initFirebase';
import { getDI } from '../di/container';

const silent: WorkflowLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

/**
 * A gravação do convidado pelo MESMO motor das automações e do agente: campo obrigatório, máscara,
 * regra, chave única e campo calculado valem igual. O que muda é o ator — o convidado, com
 * `via: 'portal'` e permissão NENHUMA: uma expressão `hasPermission(...)` disparada por essa gravação
 * responde "não", como deve responder para quem é de fora.
 */
export const portalRecordWriter: PortalRecordWriter = async ({ tenantId, collection, data, userId }) => {
  const context: WorkflowContext = {
    event: { id: '', tenantId, name: 'portal.submit', payload: {}, timestamp: new Date() },
    outputs: {},
    variables: {},
    services: {
      logger: silent,
      now: () => new Date(),
      timeZone: await tenantTimeZone(tenantId, userId),
      businessCalendarsOf: tenantBusinessCalendars,
    },
    logger: silent,
    execution: { id: crypto.randomUUID(), workflowDefinitionId: '', tenantId },
    actor: await identifyActor(userId, 'portal', []),
    input: {},
  };
  const outcome = await runWorkflowUpsert(
    { table: collection, data },
    context,
    { mutationRepository: new FirestoreWorkflowMutationRepository(getDb()), screenProvider: getDI().getScreenDefinitionCache() },
  );
  return outcome.ok
    ? { ok: true, id: outcome.value.id }
    : { ok: false, error: outcome.error, ...(outcome.errorParams ? { errorParams: outcome.errorParams } : {}) };
};
