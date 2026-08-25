import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
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
      const resolvedParams = buildNestedParams(paramEntries);

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
        return {
          success: false,
          message: '@core.automation/step.call-workflow.target-missing',
        };
      }

      if (result.status !== 'SUCCESS') {
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
