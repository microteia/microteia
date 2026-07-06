import type {
  WorkflowDefinition,
  WorkflowEvent,
  WorkflowExecution,
  WorkflowExecutionLogEntry,
} from '../entities/Workflow';
import type { WorkflowContext, WorkflowServices } from '../entities/WorkflowContext';
import type { StepRegistry } from './StepRegistry';
import { evaluateCondition } from './ConditionEvaluator';
import { resolveInputsSafe } from './InputMapping';

export interface RunWorkflowParams {
  definition: WorkflowDefinition;
  event: WorkflowEvent;
  registry: StepRegistry;
  services: WorkflowServices;
}

export const runWorkflow = async ({ definition, event, registry, services }: RunWorkflowParams): Promise<WorkflowExecution> => {
  const executionId = crypto.randomUUID();
  const startedAt = services.now();
  const logs: WorkflowExecutionLogEntry[] = [];

  const log = (
    level: WorkflowExecutionLogEntry['level'],
    message: string,
    stepId?: string,
    stepDefinitionId?: string,
    contextInput?: Record<string, unknown>,
    inputs?: Record<string, unknown>,
    outputs?: Record<string, unknown>
  ): void => {
    logs.push({ stepId, stepDefinitionId, level, message, at: services.now(), contextInput, inputs, outputs });
  };

  const finish = (status: WorkflowExecution['status'], outputs: Record<string, Record<string, unknown>>): WorkflowExecution => ({
    id: executionId,
    tenantId: definition.tenantId,
    workflowDefinitionId: definition.id,
    eventId: event.id,
    status,
    startedAt,
    finishedAt: services.now(),
    logs,
    outputs,
  });

  let conditionResult: boolean;
  try {
    conditionResult = evaluateCondition(definition.condition);
  } catch (error) {
    log('WARN', error instanceof Error ? error.message : String(error));
    return finish('PARTIAL', {});
  }

  if (!conditionResult) {
    log('INFO', 'Condição avaliada como falsa, execução ignorada');
    return finish('SUCCESS', {});
  }

  if (definition.screenKey && event.payload.screenKey !== definition.screenKey) {
    log('INFO', 'Execução ignorada: entidade customizada do evento não corresponde à tela configurada no gatilho');
    return finish('SUCCESS', {});
  }

  if (definition.lookupCollection && event.payload.collection !== definition.lookupCollection) {
    log('INFO', 'Execução ignorada: lista do evento não corresponde à lista configurada no gatilho');
    return finish('SUCCESS', {});
  }

  const context: WorkflowContext = {
    event,
    outputs: {},
    variables: {},
    services,
    logger: services.logger,
    execution: { id: executionId, workflowDefinitionId: definition.id, tenantId: definition.tenantId },
  };

  const steps = definition.steps
    .filter((step) => step.enabled)
    .sort((a, b) => a.order - b.order);

  for (const step of steps) {
    const stepDefinition = registry.resolve(step.stepDefinitionId);
    if (!stepDefinition) {
      log('ERROR', `StepDefinition desconhecida: "${step.stepDefinitionId}"`, step.id);
      return finish('FAILED', context.outputs);
    }

   const flattenedOutputs: Record<string, unknown> = {};
    for (const stepOutputs of Object.values(context.outputs)) {
      Object.assign(flattenedOutputs, stepOutputs);
    }
    context.input = Object.keys(flattenedOutputs).length > 0 ? flattenedOutputs : event.payload ?? {};

    // Usa resolveInputsSafe para garantir que inputs parciais sejam sempre registrados
    const resolveResult = resolveInputsSafe(stepDefinition.inputs, step.configuration, context);

    if (!resolveResult.success) {
      // Log com inputs parcialmente resolvidos e mensagem de erro enriquecida
      log('ERROR', `[Step "${stepDefinition.name}"] ${resolveResult.error}`, step.id, step.stepDefinitionId, context.input, resolveResult.inputs, undefined);
      return finish('FAILED', context.outputs);
    }

    const inputs = resolveResult.inputs;

    try {
      const result = await stepDefinition.createExecutor().execute(inputs, context);

      if (!result.success) {
        log('ERROR', result.message ?? 'Step falhou sem mensagem', step.id, step.stepDefinitionId, context.input, inputs, undefined);
        return finish('FAILED', context.outputs);
      }

      context.outputs[step.id] = result.outputs ?? {};
      log('SUCCESS', result.message ?? `Step "${stepDefinition.name}" concluído`, step.id, step.stepDefinitionId, context.input, inputs, result.outputs);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log('ERROR', `[Step "${stepDefinition.name}"] ${errorMessage}`, step.id, step.stepDefinitionId, context.input, inputs, undefined);
      return finish('FAILED', context.outputs);
    }
  }

  return finish('SUCCESS', context.outputs);
};
