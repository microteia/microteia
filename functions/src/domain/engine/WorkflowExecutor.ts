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
import { collectRequiredIssues, formatAndValidateParameters } from '../schema/parameterRules';
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
    outputs?: Record<string, unknown>,
    messageParams?: Record<string, string>,
  ): void => {
    logs.push({
      stepId,
      stepDefinitionId,
      level,
      message,
      messageParams,
      at: services.now(),
      contextInput,
      inputs,
      outputs,
    });
  };

  // Step cujo executor está rodando agora — usado para atribuir ao step certo as mensagens
  // que o próprio código do usuário emite (ex.: log()/console.log dentro de um Script).
  let currentLogStepId: string | undefined;
  let currentLogStepDefinitionId: string | undefined;

  // Logger encaminhado aos steps: além de ir para os logs do Cloud Functions (services.logger),
  // grava a mensagem em execution.logs para que apareça na tela (Execuções e no modal de Run).
  const captureLogger: WorkflowLogger = {
    info: (message, params) => {
      services.logger.info(message, params);
      log('INFO', message, currentLogStepId, currentLogStepDefinitionId, undefined, undefined, undefined, params);
    },
    warn: (message, params) => {
      services.logger.warn(message, params);
      log('WARN', message, currentLogStepId, currentLogStepDefinitionId, undefined, undefined, undefined, params);
    },
    error: (message, params) => {
      services.logger.error(message, params);
      log('ERROR', message, currentLogStepId, currentLogStepDefinitionId, undefined, undefined, undefined, params);
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
    log('INFO', '@core.automation/run.condition.false');
    return finish('SUCCESS', {});
  }

  if (definition.screenKey && event.payload.screenKey !== definition.screenKey) {
    log('INFO', '@core.automation/run.skipped.screen-mismatch');
    return finish('SUCCESS', {});
  }

  if (definition.lookupCollection && event.payload.collection !== definition.lookupCollection) {
    log('INFO', '@core.automation/run.skipped.lookup-mismatch');
    return finish('SUCCESS', {});
  }

  const requiredIssues = collectRequiredIssues(definition.parameters, event.payload);
  if (requiredIssues.length > 0) {
    log(
      'ERROR',
      '@core.automation/run.parameters.invalid',
      undefined, undefined, undefined, undefined, undefined,
      { detail: describeRuleIssues(requiredIssues) },
    );
    return finish('FAILED', {});
  }

  const ruledParameters = formatAndValidateParameters(definition.parameters, event.payload);
  if (ruledParameters.issues.length > 0) {
    log(
      'ERROR',
      '@core.automation/run.parameters.invalid',
      undefined, undefined, undefined, undefined, undefined,
      { detail: describeRuleIssues(ruledParameters.issues) },
    );
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

  type StepsRunResult = { ok: true; lastStepId: string | null; halted?: boolean } | { ok: false };

  // Executa uma sequência de Steps (um nível/ramo). Recursiva: um StepCondition avalia sua
  // condição e desce no ramo correspondente; ao retornar, o fluxo converge para os próximos
  // Steps deste nível. `incomingLastStepId` propaga qual foi o último Step executado, para que
  // os outputs finais do workflow reflitam a travessia inteira, não só o último nível.
  // `halted` sobe pela recursão quando um Step de encerramento roda: nenhum Step posterior
  // executa, em nenhum nível, e `lastStepId` preserva o Step cujas saídas serão o retorno.
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
            throw new Error('@core.automation/run.condition.missing');
          }
          branchResult = evaluateCondition(step.condition, context);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log(
            'ERROR',
            '@core.automation/run.condition.failed',
            step.id, undefined, context.input, undefined, undefined,
            { detail: errorMessage },
          );
          return { ok: false };
        }

        const branch = branchResult ? step.branches?.whenTrue : step.branches?.whenFalse;
        log(
          'INFO',
          branchResult
            ? '@core.automation/run.condition.true-branch'
            : '@core.automation/run.condition.false-branch',
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
        if (recur.halted) {
          return { ok: true, lastStepId, halted: true };
        }
        continue;
      }

      if (step.type === 'Loop') {
        if (!step.loop) {
          log('ERROR', '@core.automation/run.loop.missing-config', step.id, undefined, context.input);
          return { ok: false };
        }
        const { source, itemName, outputName, body } = step.loop;

        let sourceValue: unknown;
        try {
          sourceValue = resolveMapping(source, context);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log(
            'ERROR',
            '@core.automation/run.loop.failed',
            step.id, undefined, context.input, undefined, undefined,
            { detail: errorMessage },
          );
          return { ok: false };
        }

        const items = Array.isArray(sourceValue) ? sourceValue : sourceValue == null ? [] : [sourceValue];
        const bodyStepIds = flattenSteps(body).map((bodyStep) => bodyStep.id);
        const results: unknown[] = [];

        log(
          'INFO',
          '@core.automation/run.loop.start',
          step.id,
          undefined,
          context.input,
          undefined,
          { count: items.length },
          { count: String(items.length) },
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
          if (recur.halted) {
            // Encerramento dentro do corpo: não agrega nem limpa as saídas do corpo, porque o
            // retorno do workflow é justamente a saída do Step que rodou antes do encerramento.
            log('INFO', '@core.automation/run.loop.halted', step.id, undefined, context.input);
            return { ok: true, lastStepId: recur.lastStepId ?? lastStepId, halted: true };
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
          '@core.automation/run.loop.done',
          step.id,
          undefined,
          context.input,
          undefined,
          loopOutputs,
          { count: String(results.length) },
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
        log(
          'ERROR',
          '@core.automation/run.step.input-failed',
          step.id, step.stepDefinitionId, context.input, resolveResult.inputs, undefined,
          { ...resolveResult.errorParams, step: stepDefinition.name, detail: resolveResult.error ?? '' },
        );
        return { ok: false };
      }

      const inputs = resolveResult.inputs;

      currentLogStepId = step.id;
      currentLogStepDefinitionId = step.stepDefinitionId;

      try {
        const result = await stepDefinition.createExecutor().execute(inputs, context);

        if (!result.success) {
          log(
            'ERROR',
            result.message ?? '@core.automation/run.step.failed-no-message',
            step.id, step.stepDefinitionId, context.input, inputs, undefined,
            result.messageParams,
          );
          return { ok: false };
        }

        context.outputs[step.id] = result.outputs ?? {};
        log(
          'SUCCESS',
          result.message ?? '@core.automation/run.step.done',
          step.id, step.stepDefinitionId, context.input, inputs, result.outputs,
          result.messageParams ?? { name: stepDefinition.name },
        );

        if (result.halt) {
          // Um Step de encerramento não produz saída própria: `lastStepId` continua apontando
          // para o Step anterior, cujas saídas viram o retorno do workflow.
          const haltedAt = result.outputs && Object.keys(result.outputs).length > 0 ? step.id : lastStepId;
          return { ok: true, lastStepId: haltedAt, halted: true };
        }

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
