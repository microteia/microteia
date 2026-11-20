import { describe, expect, it } from 'vitest';
import { onWorkflowEventCreated } from './onWorkflowEventCreated';
import { runAction } from './runAction';
import { runWorkflowClock } from './workflowClock';
import { completeWorkflowTask } from './completeWorkflowTask';
import { decidePortalTask } from './decidePortalTask';
import { portalRecordActions } from './portalAccess';
import { WORKFLOW_EVENT_TIMEOUT_CEILING_SECONDS } from '../../domain/schema/workflowBudget';

interface Endpoint {
  availableMemoryMb?: unknown;
  timeoutSeconds?: unknown;
}

/** Sem `timeoutSeconds` declarado, o SDK põe um marcador de "padrão" (60 s numa callable), não um número. */
const DEFAULT_TIMEOUT_SECONDS = 60;

const endpointOf = (handler: unknown): Endpoint => (handler as { __endpoint: Endpoint }).__endpoint;

/**
 * Toda function que EXECUTA passos de automação pode chegar a um `read-document`. Com a memória padrão,
 * um PDF de 270 KB derrubava a instância e a execução sumia sem histórico (#6). E o teto de tempo é o que
 * `ABANDONED_RUN_AFTER_MS` presume: uma porta acima dele teria a execução viva fechada como interrompida.
 */
describe('as functions que executam automação', () => {
  const runners = {
    onWorkflowEventCreated,
    runAction,
    runWorkflowClock,
    completeWorkflowTask,
    decidePortalTask,
    portalRecordActions,
  };

  it.each(Object.entries(runners))('%s tem a memória de quem lê PDF e não passa do teto que a varredura presume', (_name, handler) => {
    const endpoint = endpointOf(handler);
    expect(endpoint.availableMemoryMb).toBe(1024);
    const timeout = typeof endpoint.timeoutSeconds === 'number' ? endpoint.timeoutSeconds : DEFAULT_TIMEOUT_SECONDS;
    expect(timeout).toBeLessThanOrEqual(WORKFLOW_EVENT_TIMEOUT_CEILING_SECONDS);
  });
});
