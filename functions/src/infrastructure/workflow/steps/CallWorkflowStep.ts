import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { parseArtifactRef } from '../../../domain/schema/plugin/artifactRef';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import type { RunCalledWorkflowUseCase } from '../../../domain/usecases/RunCalledWorkflowUseCase';
import { resolveMapping } from '../../../domain/engine/InputMapping';
import { buildNestedParams } from '../../../domain/engine/nestedParams';
import { WORKFLOW_CALLED_EVENT } from '../../../domain/schema/eventCatalog';
import { getDb } from '../../firebase/initFirebase';
import { publishEvent } from '../publishEvent';

import type { WorkflowResult } from '../../../domain/entities/WorkflowContext';
const MAX_CALL_DEPTH = 10;
const PARAM_PREFIX = 'param.';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const makeCallWorkflowStepDefinition = (runCalledWorkflow: RunCalledWorkflowUseCase): StepDefinition => ({
  ...coreStepMetadata('call-workflow'),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      const targetWorkflowId = inputs.targetWorkflowId ? String(inputs.targetWorkflowId) : '';
      if (!targetWorkflowId) {
        return { success: false, message: '@core.automation/step.call-workflow.no-target' };
      }

      const depth = Number(context.event.payload.__callDepth ?? 0);
      if (depth >= MAX_CALL_DEPTH) {
        return {
          success: false,
          message: '@core.automation/step.call-workflow.max-depth',
          messageParams: { max: String(MAX_CALL_DEPTH) },
        };
      }

      const paramEntries: [string, unknown][] = [];
      for (const [key, mapping] of Object.entries(context.stepConfiguration ?? {})) {
        if (!key.startsWith(PARAM_PREFIX)) continue;
        paramEntries.push([key.slice(PARAM_PREFIX.length), resolveMapping(mapping, context)]);
      }

      // Os parâmetros vindos EM BLOCO — um objeto pronto, tipicamente o que um passo anterior
      // extraiu de um texto livre. Entram primeiro, e os `param.<chave>` declarados um a um os
      // sobrescrevem: fixar um campo à mão é o gesto mais específico dos dois, e o específico manda.
      const bulk = isPlainObject(inputs.params) ? inputs.params : {};
      const resolvedParams = { ...bulk, ...buildNestedParams(paramEntries) };

      const waitForResult = inputs.waitForResult === true;

      if (!waitForResult) {
        await publishEvent(getDb(), context.execution.tenantId, WORKFLOW_CALLED_EVENT, {
          __targetWorkflowId: targetWorkflowId,
          __callDepth: depth + 1,
          ...resolvedParams,
        });
        return { success: true, message: '@core.automation/step.call-workflow.fired', outputs: {} };
      }

      const result = await runCalledWorkflow.execute({
        tenantId: context.execution.tenantId,
        targetWorkflowId,
        params: resolvedParams,
        callDepth: depth + 1,
      });

      if (!result.found) {
        // Quando o alvo é de outra extensão, o nome dela é a informação que resolve: a saída não é
        // "conserte o fluxo", é "instale a extensão X". Um id local pendurado não diz nem isso.
        const qualified = parseArtifactRef(targetWorkflowId);
        return qualified
          ? {
              success: false,
              message: '@core.automation/step.call-workflow.target-missing-extension',
              messageParams: { artifact: qualified.artifactId, plugin: qualified.pluginId },
            }
          : { success: false, message: '@core.automation/step.call-workflow.target-missing' };
      }

      if (result.status !== 'SUCCESS') {
        // O MOTIVO, antes do veredito: as linhas de erro da execução chamada entram no log deste
        // passo, atribuídas a ele. Sem isso, o chamador dizia só o status, e descobrir o que houve
        // era sair da tela e caçar a execução da outra automação pelo horário.
        for (const failure of result.failures) {
          context.logger.error(failure.message, failure.messageParams);
        }
        return {
          success: false,
          message: '@core.automation/step.call-workflow.bad-status',
          messageParams: { status: String(result.status) },
        };
      }

      return { success: true, message: '@core.automation/step.call-workflow.done', outputs: result.outputs };
    },
  }),
});
