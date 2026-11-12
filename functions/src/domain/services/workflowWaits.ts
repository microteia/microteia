import type { WorkflowEvent } from '../entities/Workflow';
import type { WorkflowContext, WorkflowServices } from '../entities/WorkflowContext';
import type { IWorkflowClockRepository, ResumeClockEntry } from '../repositories/IWorkflowClockRepository';
import { evaluateCondition } from '../engine/ConditionEvaluator';
import { isRecordEventName } from '../schema/workflowWait';

/**
 * Quantas esperas um evento retoma de uma vez. Um registro com centenas de execuções esperando por ele
 * é defeito de desenho de quem montou a automação, e o evento não pode virar uma função que estoura o
 * próprio tempo tentando acordar todas.
 */
export const MAX_WAITS_PER_EVENT = 50;

export interface WorkflowWaitDeps {
  clockRepository: IWorkflowClockRepository;
  services: WorkflowServices;
  /** A mesma porta do relógio — `claim` incluso. */
  resume(entry: ResumeClockEntry): Promise<unknown>;
}

/**
 * A condição da espera, contra o registro como ele CHEGOU — `event.<campo>`, o mesmo vocabulário de um
 * gatilho. As saídas e variáveis da execução também valem: "até o valor passar do que estava".
 *
 * Expressão que estoura NÃO casa, e diz por quê no log: retomar por uma condição que não se sabe
 * avaliar seria seguir o fluxo pelo caminho de quem esperou certo.
 */
const matches = (entry: ResumeClockEntry, event: WorkflowEvent, deps: WorkflowWaitDeps): boolean => {
  const until = entry.wait?.until;
  if (!until) return true;
  const context: WorkflowContext = {
    event,
    outputs: entry.outputs,
    variables: entry.variables,
    services: deps.services,
    logger: deps.services.logger,
    execution: { id: entry.executionId, workflowDefinitionId: entry.definitionId, tenantId: entry.tenantId },
    input: event.payload,
  };
  try {
    return evaluateCondition({ kind: 'Expression', expression: until }, context);
  } catch (error) {
    deps.services.logger.warn(
      `A condição da espera "${entry.executionId}" não pôde ser avaliada: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
};

/**
 * Retoma as execuções que esperavam ESTE evento deste registro (passo `wait-for`).
 *
 * A ordem é a da decisão de uma tarefa: o evento entra nas saídas do passo por `annotateResume`, que só
 * atualiza a continuação que ainda está lá e ainda não foi anotada — dois eventos que chegam juntos
 * retomam uma vez só, e o prazo que venceu no mesmo instante perde para quem anotou primeiro. Depois,
 * a retomada passa pela porta do relógio.
 *
 * O evento que CRIOU a espera não a encerra: a execução parada por ele ouviria a si mesma e seguiria na
 * hora.
 */
export const resumeWaitsForEvent = async (event: WorkflowEvent, deps: WorkflowWaitDeps): Promise<number> => {
  const recordId = typeof event.payload?.id === 'string' ? event.payload.id : '';
  if (!recordId || !isRecordEventName(event.name)) return 0;

  const waiting = await deps.clockRepository.waitingFor(event.tenantId, event.name, recordId, MAX_WAITS_PER_EVENT);
  let resumed = 0;
  for (const entry of waiting) {
    if (entry.event.id === event.id || !matches(entry, event, deps)) continue;
    const stepId = entry.afterStepId;
    const outputs = {
      ...entry.outputs,
      [stepId]: {
        ...(entry.outputs[stepId] ?? {}),
        matched: true,
        timedOut: false,
        record: event.payload,
        eventId: event.id,
        arrivedAt: event.timestamp,
      },
    };
    if ((await deps.clockRepository.annotateResume(entry, outputs)) === 'stale') continue;
    await deps.resume({ ...entry, outputs, decided: true });
    resumed += 1;
  }
  return resumed;
};
