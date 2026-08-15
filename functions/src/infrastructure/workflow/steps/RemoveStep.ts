import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { resolveMapping } from '../../../domain/engine/InputMapping';
import type { RemoveSpec, RemoveStepConfig } from '../../../domain/schema/mutationSpec';
import { runWorkflowRemove } from '../mutation/runWorkflowMutation';
import type { WorkflowMutationDeps } from '../mutation/runWorkflowMutation';

export const makeRemoveStepDefinition = (deps: WorkflowMutationDeps): StepDefinition => ({
  id: 'remove',
  version: 1,
  name: '@core.automation/step.remove.name',
  description:
    '@core.automation/step.remove.description',
  icon: 'RiDeleteBin6Line',
  category: 'Data',
  type: 'Action',
  configurable: true,
  inputs: [
    {
      id: 'remove',
      label: '@core.automation/step.remove.label.exclusao',
      required: true,
      type: 'Remove',
      allowedMappingKinds: ['Literal'],
    },
  ],
  outputDefinitions: [
    { id: 'id', label: '@core.automation/step.remove.label.id-do-registro', type: 'String' },
    { id: 'removed', label: '@core.automation/step.remove.label.foi-excluido', type: 'Boolean' },
  ],
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context) => {
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
