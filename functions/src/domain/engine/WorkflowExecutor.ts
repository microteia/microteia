import type {
  WorkflowDefinition,
  WorkflowEvent,
  WorkflowExecution,
  WorkflowExecutionLogEntry,
  WorkflowStep,
} from '../entities/Workflow';
import type { WorkflowContext, WorkflowLogger, WorkflowServices } from '../entities/WorkflowContext';
import type { StepRegistry } from './StepRegistry';
import { evaluateCondition } from './ConditionEvaluator';
import { resolveInputsSafe, resolveMapping } from './InputMapping';
import { describeRuleIssues } from '../schema/fieldRules';
import { formatAndValidateParameters } from '../schema/parameterRules';
import { flattenSteps } from '../services/stepTree';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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

  // Step cujo executor está rodando agora — usado para atribuir ao step certo as mensagens
  // que o próprio código do usuário emite (ex.: log()/console.log dentro de um Script).
  let currentLogStepId: string | undefined;
  let currentLogStepDefinitionId: string | undefined;

  // Logger encaminhado aos steps: além de ir para os logs do Cloud Functions (services.logger),
  // grava a mensagem em execution.logs para que apareça na tela (Execuções e no modal de Run).
  const captureLogger: WorkflowLogger = {
    info: (message) => {
      services.logger.info(message);
      log('INFO', message, currentLogStepId, currentLogStepDefinitionId);
    },
    warn: (message) => {
      services.logger.warn(message);
      log('WARN', message, currentLogStepId, currentLogStepDefinitionId);
    },
    error: (message) => {
      services.logger.error(message);
      log('ERROR', message, currentLogStepId, currentLogStepDefinitionId);
    },
  };

  const finish = (status: WorkflowExecution['status'], outputs: Record<string, unknown>): WorkflowExecution => ({
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

  // Context parcial para avaliação da condição (antes de executar steps)
  const conditionContext: WorkflowContext = {
    event,
    outputs: {},
    variables: {},
    services,
    logger: captureLogger,
    execution: { id: executionId, workflowDefinitionId: definition.id, tenantId: definition.tenantId },
  };

  let conditionResult: boolean;
  try {
    conditionResult = evaluateCondition(definition.condition, conditionContext);
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

  const ruledParameters = formatAndValidateParameters(definition.parameters, event.payload);
  if (ruledParameters.issues.length > 0) {
    log('ERROR', `Parâmetros do workflow inválidos: ${describeRuleIssues(ruledParameters.issues)}`);
    return finish('FAILED', {});
  }

  const context: WorkflowContext = {
    event: { ...event, payload: ruledParameters.data },
    outputs: {},
    variables: {},
    services,
    logger: captureLogger,
    execution: { id: executionId, workflowDefinitionId: definition.id, tenantId: definition.tenantId },
  };

  // Monta context.input a partir do flatten das saídas acumuladas (só Steps já executados) —
  // igual para Steps normais e para nós de controle StepCondition.
  const applyStepInput = (): void => {
    const flattenedOutputs: Record<string, unknown> = {};
    for (const stepOutputs of Object.values(context.outputs)) {
      Object.assign(flattenedOutputs, stepOutputs);
    }
    context.input = Object.keys(flattenedOutputs).length > 0 ? flattenedOutputs : event.payload ?? {};
  };

  type StepsRunResult = { ok: true; lastStepId: string | null } | { ok: false };

  // Executa uma sequência de Steps (um nível/ramo). Recursiva: um StepCondition avalia sua
  // condição e desce no ramo correspondente; ao retornar, o fluxo converge para os próximos
  // Steps deste nível. `incomingLastStepId` propaga qual foi o último Step executado, para que
  // os outputs finais do workflow reflitam a travessia inteira, não só o último nível.
  const executeSteps = async (branchSteps: WorkflowStep[], incomingLastStepId: string | null): Promise<StepsRunResult> => {
    let lastStepId = incomingLastStepId;

    const ordered = branchSteps
      .filter((step) => step.enabled)
      .sort((a, b) => a.order - b.order);

    for (const step of ordered) {
      applyStepInput();
      currentLogStepId = undefined;
      currentLogStepDefinitionId = undefined;

      if (step.type === 'Condition') {
        let branchResult: boolean;
        try {
          if (!step.condition) {
            throw new Error('StepCondition sem condição configurada');
          }
          branchResult = evaluateCondition(step.condition, context);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log('ERROR', `[Condição] ${errorMessage}`, step.id, undefined, context.input);
          return { ok: false };
        }

        const branch = branchResult ? step.branches?.whenTrue : step.branches?.whenFalse;
        log(
          'INFO',
          `Condição avaliada como ${branchResult ? 'verdadeira' : 'falsa'} — ramo "${branchResult ? 'Verdadeiro' : 'Falso'}"`,
          step.id,
          undefined,
          context.input,
          undefined,
          { result: branchResult },
        );

        const recur = await executeSteps(branch ?? [], lastStepId);
        if (!recur.ok) {
          return { ok: false };
        }
        lastStepId = recur.lastStepId;
        continue;
      }

      if (step.type === 'Loop') {
        if (!step.loop) {
          log('ERROR', '[Repetição] Nó de repetição sem configuração', step.id, undefined, context.input);
          return { ok: false };
        }
        const { source, itemName, outputName, body } = step.loop;

        let sourceValue: unknown;
        try {
          sourceValue = resolveMapping(source, context);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log('ERROR', `[Repetição] ${errorMessage}`, step.id, undefined, context.input);
          return { ok: false };
        }

        const items = Array.isArray(sourceValue) ? sourceValue : sourceValue == null ? [] : [sourceValue];
        const bodyStepIds = flattenSteps(body).map((bodyStep) => bodyStep.id);
        const results: unknown[] = [];

        log(
          'INFO',
          `Repetição sobre ${items.length} ${items.length === 1 ? 'item' : 'itens'}`,
          step.id,
          undefined,
          context.input,
          undefined,
          { count: items.length },
        );

        let loopFailed = false;
        for (const item of items) {
          for (const bodyStepId of bodyStepIds) delete context.outputs[bodyStepId];
          context.outputs[step.id] = isPlainObject(item) ? { ...item } : { [itemName]: item };

          const recur = await executeSteps(body, null);
          if (!recur.ok) {
            loopFailed = true;
            break;
          }
          results.push(recur.lastStepId ? context.outputs[recur.lastStepId] ?? {} : {});
        }

        for (const bodyStepId of bodyStepIds) delete context.outputs[bodyStepId];
        if (loopFailed) {
          return { ok: false };
        }

        const loopOutputs = { [outputName]: results };
        context.outputs[step.id] = loopOutputs;
        log(
          'SUCCESS',
          `Repetição concluída — ${results.length} ${results.length === 1 ? 'resultado' : 'resultados'}`,
          step.id,
          undefined,
          context.input,
          undefined,
          loopOutputs,
        );
        lastStepId = step.id;
        continue;
      }

      const stepDefinition = registry.resolve(step.stepDefinitionId);
      if (!stepDefinition) {
        log('ERROR', `StepDefinition desconhecida: "${step.stepDefinitionId}"`, step.id);
        return { ok: false };
      }

      context.stepConfiguration = step.configuration;

      // Usa resolveInputsSafe para garantir que inputs parciais sejam sempre registrados
      const resolveResult = resolveInputsSafe(stepDefinition.inputs, step.configuration, context);

      if (!resolveResult.success) {
        // Log com inputs parcialmente resolvidos e mensagem de erro enriquecida
        log('ERROR', `[Step "${stepDefinition.name}"] ${resolveResult.error}`, step.id, step.stepDefinitionId, context.input, resolveResult.inputs, undefined);
        return { ok: false };
      }

      const inputs = resolveResult.inputs;

      currentLogStepId = step.id;
      currentLogStepDefinitionId = step.stepDefinitionId;

      try {
        const result = await stepDefinition.createExecutor().execute(inputs, context);

        if (!result.success) {
          log('ERROR', result.message ?? 'Step falhou sem mensagem', step.id, step.stepDefinitionId, context.input, inputs, undefined);
          return { ok: false };
        }

        context.outputs[step.id] = result.outputs ?? {};
        log('SUCCESS', result.message ?? `Step "${stepDefinition.name}" concluído`, step.id, step.stepDefinitionId, context.input, inputs, result.outputs);
        lastStepId = step.id;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log('ERROR', `[Step "${stepDefinition.name}"] ${errorMessage}`, step.id, step.stepDefinitionId, context.input, inputs, undefined);
        return { ok: false };
      }
    }

    return { ok: true, lastStepId };
  };

  const run = await executeSteps(definition.steps, null);
  if (!run.ok) {
    return finish('FAILED', {});
  }

  // Retorna apenas os outputs do último step executado na travessia
  const finalOutputs = run.lastStepId ? context.outputs[run.lastStepId] ?? {} : {};
  return finish('SUCCESS', finalOutputs);
};
