import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import { resolveMapping } from '../../../domain/engine/InputMapping';
import type { RemoveSpec, RemoveStepConfig } from '../../../domain/schema/mutationSpec';
import { runWorkflowRemove } from '../mutation/runWorkflowMutation';
import type { WorkflowMutationDeps } from '../mutation/runWorkflowMutation';

import type { WorkflowResult } from '../../../domain/entities/WorkflowContext';
export const makeRemoveStepDefinition = (deps: WorkflowMutationDeps): StepDefinition => ({
  ...coreStepMetadata('remove'),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      const config = inputs.remove as RemoveStepConfig | undefined;
      if (!config || typeof config !== 'object' || !config.table || !config.id) {
        return { success: false, message: '@core.automation/step.remove.not-configured' };
      }

      const resolvedId = resolveMapping(config.id, context);
      if (resolvedId === undefined || resolvedId === null || String(resolvedId).trim() === '') {
        return { success: false, message: '@core.automation/mutation.remove.id.missing' };
      }

      const spec: RemoveSpec = { table: config.table, id: String(resolvedId) };
      const outcome = await runWorkflowRemove(spec, context, deps);
      if (!outcome.ok) {
        return { success: false, message: outcome.error };
      }

      const { id, removed } = outcome.value;
      return {
        success: true,
        message: removed
          ? '@core.automation/step.remove.done'
          : '@core.automation/step.remove.not-found',
        messageParams: { table: config.table },
        outputs: { id, removed },
      };
    },
  }),
});
