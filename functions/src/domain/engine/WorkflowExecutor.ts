import type {
  WorkflowDefinition,
  WorkflowEvent,
  WorkflowExecution,
  WorkflowExecutionLogEntry,
  WorkflowStep,
} from '../entities/Workflow';
import type { WorkflowContext, WorkflowLogger, WorkflowResult, WorkflowServices } from '../entities/WorkflowContext';
import type { StepRegistry } from './StepRegistry';
import { evaluateCondition } from './ConditionEvaluator';
import { resolveInputsSafe, resolveMapping } from './InputMapping';
import { ruleIssueParams } from '../schema/fieldRules';
import { collectRequiredIssues, formatAndValidateParameters } from '../schema/parameterRules';
import { toStored } from '../schema/storedReference';
import { flattenSteps } from '../services/stepTree';
import { isStepExcludedFromTrigger } from '../schema/workflowStepCatalog';
import { matchesChangeFilter } from '../schema/workflowChangeFilter';
import { MAX_STEP_RETRIES } from '../entities/Workflow';
import type { WorkflowWait } from '../schema/workflowWait';
import { pagedLoopPageSize } from '../schema/workflowLoopQuery';
import type { PagedLoopState, WorkflowLoopQuery } from '../schema/workflowLoopQuery';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Onde a execução parou num passo `delay`, e o que ela precisa para continuar dali. */
export interface WorkflowSuspension {
  resumeAt: Date;
  /** A tarefa humana que a pausa espera, quando é uma aprovação. */
  taskId?: string;
  /** O evento que a pausa espera, quando é um `wait-for`. */
  wait?: WorkflowWait;
  /** Onde o laço paginado parou — a retomada volta AO laço, com este cursor. */
  loop?: PagedLoopState;
  afterStepId: string;
  lastStepId: string | null;
  outputs: Record<string, Record<string, unknown>>;
  variables: Record<string, unknown>;
}

/** A continuação de uma execução que esperou: a mesma identidade, o histórico até ali e o estado. */
export interface WorkflowResume extends Omit<WorkflowSuspension, 'resumeAt' | 'taskId' | 'wait'> {
  executionId: string;
  startedAt: Date;
  logs: WorkflowExecutionLogEntry[];
}

/**
 * Por que a porta deixou a execução de fora sem que isso seja falha: a condição da automação, ou o filtro
 * de tela ou de lista. O status continua `SUCCESS` — para um gatilho, "não era comigo" não é erro —, e
 * é esta marca que deixa o chamador distinguir "não rodou" de "rodou e não devolveu nada".
 */
export type WorkflowSkip = 'condition' | 'screen' | 'lookup' | 'change';

/**
 * A espera entre duas tentativas de um passo: 1s, 2s, 3s. Curta de propósito — a tentativa roda
 * DENTRO da execução, e o que pede espera longa (um serviço fora do ar por minutos) é o HTTP
 * assíncrono, que tem fila e retentativas próprias.
 */
const RETRY_BACKOFF_MS = 1000;

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

export type WorkflowRun = WorkflowExecution & { suspension?: WorkflowSuspension; skipped?: WorkflowSkip };

export interface RunWorkflowParams {
  definition: WorkflowDefinition;
  event: WorkflowEvent;
  registry: StepRegistry;
  services: WorkflowServices;
  /** Quem disparou, quando alguém disparou. Ver `WorkflowContext.actor`. */
  actor?: WorkflowContext['actor'];
  /**
   * A execução pode PAUSAR num passo `delay`. Só a que nasce do barramento de eventos pode: quem espera
   * a resposta — um botão, um `call-workflow` aguardando, o depurador — não tem como esperar dias.
   */
  suspendable?: boolean;
  /** Continua uma execução que esperou, a partir do passo seguinte ao `delay`. */
  resume?: WorkflowResume;
}

export const runWorkflow = async ({
  definition,
  event,
  registry,
  services,
  actor,
  suspendable,
  resume,
}: RunWorkflowParams): Promise<WorkflowRun> => {
  const executionId = resume?.executionId ?? crypto.randomUUID();
  const startedAt = resume?.startedAt ?? services.now();
  const logs: WorkflowExecutionLogEntry[] = [...(resume?.logs ?? [])];
  // O laço paginado de onde a execução volta: lido UMA vez, pelo próprio laço, na primeira passagem.
  let resumedLoop: PagedLoopState | null = resume?.loop ?? null;

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
    // O campo ausente fica FORA da linha, e não `undefined` dentro dela: o histórico é gravado no fim
    // da execução, e um `undefined` recusado ali perde a evidência de efeitos já aplicados.
    logs.push({
      level,
      message,
      at: services.now(),
      ...(stepId === undefined ? {} : { stepId }),
      ...(stepDefinitionId === undefined ? {} : { stepDefinitionId }),
      ...(messageParams === undefined ? {} : { messageParams }),
      ...(contextInput === undefined ? {} : { contextInput }),
      ...(inputs === undefined ? {} : { inputs }),
      ...(outputs === undefined ? {} : { outputs }),
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

  const buildContext = (
    payload: Record<string, unknown>,
    outputs: Record<string, Record<string, unknown>>,
    variables: Record<string, unknown>,
  ): WorkflowContext => ({
    event: { ...event, payload },
    outputs,
    variables,
    services,
    logger: captureLogger,
    execution: { id: executionId, workflowDefinitionId: definition.id, tenantId: definition.tenantId },
    ...(definition.parameters?.length ? { parameters: definition.parameters } : {}),
    ...(actor ? { actor } : {}),
  });

  /**
   * A PORTA da execução nova: a condição da automação, os filtros de tela/lista e os parâmetros. Devolve o
   * contexto em que os passos rodam, ou o desfecho de quem não passou. Uma execução que CONTINUA depois
   * de esperar não passa por aqui de novo — ela já passou quando começou.
   */
  type Admission = { context: WorkflowContext } | { refused: WorkflowExecution['status']; skipped?: WorkflowSkip };

  const admit = (): Admission => {
    const conditionContext = buildContext(event.payload, {}, {});
    let conditionResult: boolean;
    try {
      conditionResult = evaluateCondition(definition.condition, conditionContext);
    } catch (error) {
      log('WARN', error instanceof Error ? error.message : String(error));
      return { refused: 'PARTIAL' };
    }

    if (!conditionResult) {
      log('INFO', '@core.automation/run.condition.false');
      return { refused: 'SUCCESS', skipped: 'condition' };
    }

    if (definition.screenKey && event.payload.screenKey !== definition.screenKey) {
      log('INFO', '@core.automation/run.skipped.screen-mismatch');
      return { refused: 'SUCCESS', skipped: 'screen' };
    }

    if (definition.lookupCollection && event.payload.collection !== definition.lookupCollection) {
      log('INFO', '@core.automation/run.skipped.lookup-mismatch');
      return { refused: 'SUCCESS', skipped: 'lookup' };
    }

    if (!matchesChangeFilter(definition, event.payload)) {
      log('INFO', '@core.automation/run.skipped.change-mismatch');
      return { refused: 'SUCCESS', skipped: 'change' };
    }

    const requiredIssues = collectRequiredIssues(definition.parameters, event.payload);
    if (requiredIssues.length > 0) {
      log(
        'ERROR',
        '@core.automation/run.parameters.invalid',
        undefined, undefined, undefined, undefined, undefined,
        ruleIssueParams(requiredIssues),
      );
      return { refused: 'FAILED' };
    }

    const ruledParameters = formatAndValidateParameters(definition.parameters, event.payload);
    if (ruledParameters.issues.length > 0) {
      log(
        'ERROR',
        '@core.automation/run.parameters.invalid',
        undefined, undefined, undefined, undefined, undefined,
        ruleIssueParams(ruledParameters.issues),
      );
      return { refused: 'FAILED' };
    }

    return { context: buildContext(ruledParameters.data, {}, {}) };
  };

  const admission: Admission = resume
    ? { context: buildContext(event.payload, resume.outputs, resume.variables) }
    : admit();
  if ('refused' in admission) {
    const refused = finish(admission.refused, {});
    return admission.skipped ? { ...refused, skipped: admission.skipped } : refused;
  }
  const { context } = admission;
  if (resume) log('INFO', '@core.automation/run.delay.resumed');

  // Monta context.input a partir do flatten das saídas acumuladas (só Steps já executados) —
  // igual para Steps normais e para nós de controle StepCondition.
  const applyStepInput = (): void => {
    const flattenedOutputs: Record<string, unknown> = {};
    for (const stepOutputs of Object.values(context.outputs)) {
      Object.assign(flattenedOutputs, stepOutputs);
    }
    context.input = Object.keys(flattenedOutputs).length > 0 ? flattenedOutputs : (toStored(event.payload ?? {}) as Record<string, unknown>);
  };

  type StepsRunResult =
    | {
      ok: true;
      lastStepId: string | null;
      halted?: boolean;
      suspended?: { resumeAt: Date; afterStepId: string; taskId?: string; wait?: WorkflowWait; loop?: PagedLoopState };
    }
    | { ok: false };

  // Executa uma sequência de Steps (um nível/ramo). Recursiva: um StepCondition avalia sua
  // condição e desce no ramo correspondente; ao retornar, o fluxo converge para os próximos
  // Steps deste nível. `incomingLastStepId` propaga qual foi o último Step executado, para que
  // os outputs finais do workflow reflitam a travessia inteira, não só o último nível.
  // `halted` sobe pela recursão quando um Step de encerramento roda: nenhum Step posterior
  // executa, em nenhum nível, e `lastStepId` preserva o Step cujas saídas serão o retorno.
  // `depth` é o nível de aninhamento: 0 é o fluxo principal. Só ali uma espera pode pausar — retomar no
  // meio de um ramo ou de uma iteração pediria guardar a travessia inteira, e não só o próximo passo.
  const executeSteps = async (
    branchSteps: WorkflowStep[],
    incomingLastStepId: string | null,
    depth = 0,
  ): Promise<StepsRunResult> => {
    let lastStepId = incomingLastStepId;

    const ordered = branchSteps
      .filter((step) => step.enabled)
      .sort((a, b) => a.order - b.order);

    for (const step of ordered) {
      applyStepInput();
      currentLogStepId = undefined;
      currentLogStepDefinitionId = undefined;

      // Passado o orçamento, a execução termina AQUI, gravada e explicada — e não cortada pela
      // plataforma no meio de um passo, sem histórico. Sem orçamento, nada muda.
      if (services.deadlineAt !== undefined && services.now().getTime() >= services.deadlineAt) {
        log('ERROR', '@core.automation/run.budget-exceeded', step.id, step.stepDefinitionId, context.input);
        return { ok: false };
      }

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

        const recur = await executeSteps(branch ?? [], lastStepId, depth + 1);
        if (!recur.ok) {
          return { ok: false };
        }
        lastStepId = recur.lastStepId;
        if (recur.halted) {
          return { ok: true, lastStepId, halted: true };
        }
        continue;
      }

      if (step.type === 'Switch') {
        if (!step.switch) {
          log('ERROR', '@core.automation/run.switch.missing-config', step.id, undefined, context.input);
          return { ok: false };
        }

        // O PRIMEIRO caminho cuja condição vale é o único que roda — a ordem declarada é a prioridade,
        // como num `switch` com `break`. Uma condição que estoura não cai no "senão": o "senão" é uma
        // decisão de negócio, e tomá-la por causa de um erro seria agir sobre o que ninguém escolheu.
        let chosen: number;
        try {
          chosen = step.switch.cases.findIndex((one) => evaluateCondition(one.condition, context));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log(
            'ERROR',
            '@core.automation/run.switch.failed',
            step.id, undefined, context.input, undefined, undefined,
            { detail: errorMessage },
          );
          return { ok: false };
        }

        const picked = chosen >= 0 ? step.switch.cases[chosen] : undefined;
        log(
          'INFO',
          picked ? '@core.automation/run.switch.case' : '@core.automation/run.switch.otherwise',
          step.id,
          undefined,
          context.input,
          undefined,
          { case: picked ? picked.id : null },
          picked ? { case: picked.label || picked.id } : undefined,
        );

        const recur = await executeSteps(picked ? picked.steps : step.switch.otherwise, lastStepId, depth + 1);
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

        if (step.loop.query) {
          const paged = await runPagedLoop(step, step.loop.query, itemName, body, depth, lastStepId);
          if (!paged.ok || paged.halted || paged.suspended) return paged;
          lastStepId = paged.lastStepId;
          continue;
        }

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

          const recur = await executeSteps(body, null, depth + 1);
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

      // O núcleo primeiro; o que ele não conhece pode ser passo de uma extensão do escritório.
      const extension = registry.resolve(step.stepDefinitionId) || !services.extensionStep
        ? null
        : await services.extensionStep(step.stepDefinitionId, definition.tenantId);
      if (extension && !extension.ok) {
        log('ERROR', extension.error, step.id, step.stepDefinitionId, context.input, undefined, undefined, extension.errorParams);
        return { ok: false };
      }
      const stepDefinition = registry.resolve(step.stepDefinitionId) ?? (extension?.ok ? extension.definition : undefined);
      if (!stepDefinition) {
        log('ERROR', `StepDefinition desconhecida: "${step.stepDefinitionId}"`, step.id);
        return { ok: false };
      }

      // A automação que chegou por fora do editor e da validação de pacote — importada, gravada à mão —
      // não executa o passo que o próprio catálogo declara incompatível com o gatilho dela.
      if (isStepExcludedFromTrigger(stepDefinition, definition.eventName)) {
        log(
          'ERROR',
          '@core.automation/run.step.excluded-trigger',
          step.id, step.stepDefinitionId, context.input, undefined, undefined,
          { step: stepDefinition.name, event: definition.eventName },
        );
        return { ok: false };
      }

      context.stepConfiguration = step.configuration;
      context.stepId = step.id;
      context.canSuspend = suspendable === true && depth === 0;

      // Usa resolveInputsSafe para garantir que inputs parciais sejam sempre registrados
      const resolveResult = resolveInputsSafe(stepDefinition.inputs, step.configuration, context);

      const continueOnError = step.onError?.action === 'continue';
      const retries = Math.max(0, Math.min(MAX_STEP_RETRIES, Math.trunc(step.onError?.retries ?? 0)));

      /*
       * O passo FALHOU, e a política dele decide o resto: `continue` publica a falha como saída e
       * segue; o padrão encerra a execução. A falha é registrada do mesmo jeito nos dois casos — quem
       * lê o histórico precisa vê-la, e um "continuou" sem o erro ao lado seria um defeito escondido.
       */
      const failStep = (message: string): boolean => {
        if (!continueOnError) return false;
        context.outputs[step.id] = { failed: true, error: message };
        log(
          'WARN',
          '@core.automation/run.step.continued',
          step.id, step.stepDefinitionId, context.input, undefined, context.outputs[step.id],
          { step: stepDefinition.name },
        );
        lastStepId = step.id;
        return true;
      };

      if (!resolveResult.success) {
        // Log com inputs parcialmente resolvidos e mensagem de erro enriquecida
        log(
          'ERROR',
          '@core.automation/run.step.input-failed',
          step.id, step.stepDefinitionId, context.input, resolveResult.inputs, undefined,
          { ...resolveResult.errorParams, step: stepDefinition.name, detail: resolveResult.error ?? '' },
        );
        // Entrada que não resolve não melhora tentando de novo: é a configuração, não o mundo.
        if (failStep(resolveResult.error ?? '@core.automation/run.step.input-failed')) continue;
        return { ok: false };
      }

      const inputs = resolveResult.inputs;

      currentLogStepId = step.id;
      currentLogStepDefinitionId = step.stepDefinitionId;

      /*
       * Uma TENTATIVA: a falha devolvida e a exceção lançada são a mesma notícia para a política do
       * passo. Sem unificá-las, um serviço que caiu lançando não seria tentado de novo, e o que caiu
       * respondendo seria — a mesma queda, duas respostas.
       */
      const runOnce = async (): Promise<WorkflowResult> => {
        try {
          return await stepDefinition.createExecutor().execute(inputs, context);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            message: '@core.automation/run.step.threw',
            messageParams: { step: stepDefinition.name, detail: errorMessage },
          };
        }
      };

      try {
        let result = await runOnce();

        /*
         * As NOVAS TENTATIVAS declaradas. Cada uma espera um pouco mais que a anterior, e nenhuma
         * começa se a espera atravessaria o orçamento da execução: estourá-lo no meio de uma tentativa
         * seria trocar uma falha registrada por uma execução cortada sem histórico.
         */
        for (let attempt = 1; !result.success && attempt <= retries; attempt += 1) {
          const wait = RETRY_BACKOFF_MS * attempt;
          if (services.deadlineAt !== undefined && services.now().getTime() + wait >= services.deadlineAt) break;
          log(
            'WARN',
            '@core.automation/run.step.retrying',
            step.id, step.stepDefinitionId, context.input, inputs, undefined,
            {
              step: stepDefinition.name,
              attempt: String(attempt),
              of: String(retries),
              detail: result.message ?? '',
            },
          );
          await (services.sleep ?? defaultSleep)(wait);
          result = await runOnce();
        }

        if (!result.success) {
          const message = result.message ?? '@core.automation/run.step.failed-no-message';
          log(
            'ERROR',
            message,
            step.id, step.stepDefinitionId, context.input, inputs, undefined,
            result.messageParams,
          );
          // A saída `error` leva o DETALHE quando há um — é o que um passo seguinte compara —, e a
          // referência da mensagem quando o passo não disse mais que isso.
          if (failStep(result.messageParams?.detail ?? message)) continue;
          return { ok: false };
        }

        context.outputs[step.id] = result.outputs ?? {};
        log(
          'SUCCESS',
          result.message ?? '@core.automation/run.step.done',
          step.id, step.stepDefinitionId, context.input, inputs, result.outputs,
          result.messageParams ?? { name: stepDefinition.name },
        );

        if (result.suspend) {
          if (!suspendable) {
            log('ERROR', '@core.automation/run.delay.not-suspendable', step.id, step.stepDefinitionId, context.input);
            return { ok: false };
          }
          if (depth > 0) {
            log('ERROR', '@core.automation/run.delay.nested', step.id, step.stepDefinitionId, context.input);
            return { ok: false };
          }
          return {
            ok: true,
            lastStepId: step.id,
            suspended: {
              resumeAt: result.suspend.resumeAt,
              afterStepId: step.id,
              ...(result.suspend.taskId ? { taskId: result.suspend.taskId } : {}),
              ...(result.suspend.wait ? { wait: result.suspend.wait } : {}),
            },
          };
        }

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
        if (failStep(errorMessage)) continue;
        return { ok: false };
      }
    }

    return { ok: true, lastStepId };
  };

  /**
   * O laço sobre uma CONSULTA, uma página por vez.
   *
   * Cada página roda o corpo para cada registro; havendo mais, a execução PAUSA com o cursor
   * (`suspended.loop`) para a próxima volta do relógio, e a retomada volta a este laço — é o que quebra
   * o teto de uma consulta sem estourar o orçamento de uma execução. As contribuições do corpo NÃO se
   * acumulam entre páginas (seriam o próprio volume que o laço existe para não carregar): a saída do laço
   * é o que foi feito, `processed` e `pages`.
   *
   * Pausa, então tem as regras de quem pausa: só no nível principal de uma execução que pode esperar.
   */
  const runPagedLoop = async (
    step: WorkflowStep,
    query: WorkflowLoopQuery,
    itemName: string,
    body: WorkflowStep[],
    depth: number,
    lastStepId: string | null,
  ): Promise<StepsRunResult> => {
    if (!suspendable || depth > 0) {
      log('ERROR', '@core.automation/run.loop.paged-cannot-wait', step.id, undefined, context.input);
      return { ok: false };
    }
    if (!services.queryPage) {
      log('ERROR', '@core.automation/run.loop.paged-unavailable', step.id, undefined, context.input);
      return { ok: false };
    }

    const resumed = resumedLoop?.stepId === step.id ? resumedLoop : null;
    resumedLoop = null;
    const pageSize = pagedLoopPageSize(query.pageSize);
    const page = await services.queryPage(query.spec, resumed?.cursor ?? null, pageSize, context);
    if (!page.ok) {
      log('ERROR', page.error, step.id, undefined, context.input, undefined, undefined, page.errorParams);
      return { ok: false };
    }

    const pageNumber = (resumed?.page ?? 0) + 1;
    log(
      'INFO', '@core.automation/run.loop.page', step.id, undefined, context.input, undefined,
      { page: pageNumber, count: page.items.length },
      { page: String(pageNumber), count: String(page.items.length) },
    );

    const bodyStepIds = flattenSteps(body).map((bodyStep) => bodyStep.id);
    for (const item of page.items) {
      for (const bodyStepId of bodyStepIds) delete context.outputs[bodyStepId];
      context.outputs[step.id] = isPlainObject(item) ? { ...item } : { [itemName]: item };
      const recur = await executeSteps(body, null, depth + 1);
      if (!recur.ok) return { ok: false };
      if (recur.halted) {
        log('INFO', '@core.automation/run.loop.halted', step.id, undefined, context.input);
        return { ok: true, lastStepId: recur.lastStepId ?? lastStepId, halted: true };
      }
    }
    for (const bodyStepId of bodyStepIds) delete context.outputs[bodyStepId];

    const processed = (resumed?.processed ?? 0) + page.items.length;
    if (page.hasMore && page.cursor) {
      // O item da última iteração não atravessa a pausa: ele não é saída de ninguém, e a continuação
      // tem teto de tamanho.
      delete context.outputs[step.id];
      return {
        ok: true,
        lastStepId,
        suspended: {
          resumeAt: services.now(),
          afterStepId: step.id,
          loop: { stepId: step.id, cursor: page.cursor, page: pageNumber, processed },
        },
      };
    }

    const loopOutputs = { processed, pages: pageNumber };
    context.outputs[step.id] = loopOutputs;
    log(
      'SUCCESS', '@core.automation/run.loop.paged-done', step.id, undefined, context.input, undefined, loopOutputs,
      { count: String(processed), pages: String(pageNumber) },
    );
    return { ok: true, lastStepId: step.id };
  };

  let topLevel = definition.steps;
  if (resume?.loop) {
    // Voltando de uma PÁGINA: o laço paginado roda de novo — a partir do cursor guardado —, e só depois
    // dele os passos seguintes.
    const loopStep = definition.steps.find((step) => step.id === resume.loop?.stepId);
    if (!loopStep?.loop?.query) {
      log('WARN', '@core.automation/run.delay.step-missing', resume.loop.stepId);
      return finish('CANCELLED', {});
    }
    topLevel = definition.steps.filter((step) => step.order >= loopStep.order);
  } else if (resume) {
    // Continua pelos passos POSTERIORES ao que esperou, na definição de AGORA: a automação editada
    // durante a espera segue a versão nova. Sem o passo em que parou, não há "depois" a seguir.
    const anchor = definition.steps.find((step) => step.id === resume.afterStepId);
    if (!anchor) {
      log('WARN', '@core.automation/run.delay.step-missing', resume.afterStepId);
      return finish('CANCELLED', {});
    }
    topLevel = definition.steps.filter((step) => step.order > anchor.order);
  }

  const run = await executeSteps(topLevel, resume?.lastStepId ?? null);
  if (!run.ok) {
    return finish('FAILED', {});
  }

  if (run.suspended) {
    const { resumeAt, afterStepId, taskId, wait, loop } = run.suspended;
    return {
      ...finish('WAITING', {}),
      finishedAt: undefined,
      resumeAt,
      suspension: {
        resumeAt,
        afterStepId,
        ...(taskId ? { taskId } : {}),
        ...(wait ? { wait } : {}),
        ...(loop ? { loop } : {}),
        lastStepId: run.lastStepId,
        outputs: context.outputs,
        variables: context.variables,
      },
    };
  }

  // Retorna apenas os outputs do último step executado na travessia
  const finalOutputs = run.lastStepId ? context.outputs[run.lastStepId] ?? {} : {};
  return finish('SUCCESS', finalOutputs);
};
