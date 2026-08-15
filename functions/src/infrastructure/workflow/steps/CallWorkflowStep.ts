import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import type { RunCalledWorkflowUseCase } from '../../../domain/usecases/RunCalledWorkflowUseCase';
import { resolveMapping } from '../../../domain/engine/InputMapping';
import { buildNestedParams } from '../../../domain/engine/nestedParams';
import { WORKFLOW_CALLED_EVENT } from '../../../domain/schema/eventCatalog';
import { getDb } from '../../firebase/initFirebase';
import { publishEvent } from '../publishEvent';

const MAX_CALL_DEPTH = 10;
const PARAM_PREFIX = 'param.';

export const makeCallWorkflowStepDefinition = (runCalledWorkflow: RunCalledWorkflowUseCase): StepDefinition => ({
  id: 'call-workflow',
  version: 1,
  name: '@core.automation/step.call-workflow.name',
  description: '@core.automation/step.call-workflow.description',
  icon: 'RiFlowChart',
  category: 'Action',
  type: 'SubWorkflow',
  configurable: true,
  inputs: [
    {
      id: 'targetWorkflowId',
      label: '@core.automation/step.call-workflow.label.workflow-a-chamar',
      required: true,
      type: 'String',
      allowedMappingKinds: ['Literal'],
    },
    {
      id: 'waitForResult',
      label: '@core.automation/step.call-workflow.label.aguardar-retorno',
      description:
        '@core.automation/step.call-workflow.wait.description',
      required: false,
      type: 'Boolean',
      defaultValue: false,
      allowedMappingKinds: ['Literal'],
    },
  ],
  outputDefinitions: [],
  dynamicInputs: { kind: 'from-target-workflow-parameters', sourceInputId: 'targetWorkflowId' },
  dynamicOutputs: {
    kind: 'from-target-workflow-outputs',
    sourceInputId: 'targetWorkflowId',
    description: '@core.automation/step.call-workflow.description',
  },
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context) => {
      const targetWorkflowId = inputs.targetWorkflowId ? String(inputs.targetWorkflowId) : '';
      if (!targetWorkflowId) {
        return { success: false, message: 'Nenhum workflow-alvo foi selecionado' };
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
      const resolvedParams = buildNestedParams(paramEntries);

      const waitForResult = inputs.waitForResult === true;

      if (!waitForResult) {
        await publishEvent(getDb(), context.execution.tenantId, WORKFLOW_CALLED_EVENT, {
          __targetWorkflowId: targetWorkflowId,
          __callDepth: depth + 1,
          ...resolvedParams,
        });
        return { success: true, message: 'Workflow chamado', outputs: {} };
      }

      const result = await runCalledWorkflow.execute({
        tenantId: context.execution.tenantId,
        targetWorkflowId,
        params: resolvedParams,
        callDepth: depth + 1,
      });

      if (!result.found) {
        return {
          success: false,
          message: '@core.automation/step.call-workflow.target-missing',
        };
      }

      if (result.status !== 'SUCCESS') {
        return { success: false, message: `Workflow chamado terminou com status "${result.status}"` };
      }

      return { success: true, message: '@core.automation/step.call-workflow.done', outputs: result.outputs };
    },
  }),
});
