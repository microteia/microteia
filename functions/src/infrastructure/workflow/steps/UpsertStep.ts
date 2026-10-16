import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import type { UpsertSpec, UpsertStepConfig } from '../../../domain/schema/mutationSpec';
import { getValueAtPath, parsePath } from '../../../domain/schema/pathResolver';
import { toStored } from '../../../domain/schema/storedReference';
import { runWorkflowUpsert } from '../mutation/runWorkflowMutation';
import type { WorkflowMutationDeps } from '../mutation/runWorkflowMutation';

import type { WorkflowResult } from '../../../domain/entities/WorkflowContext';
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const makeUpsertStepDefinition = (deps: WorkflowMutationDeps): StepDefinition => ({
  ...coreStepMetadata('upsert'),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      const config = inputs.upsert as UpsertStepConfig | undefined;
      if (!config || typeof config !== 'object' || !config.table || !config.source) {
        return { success: false, message: '@core.automation/step.upsert.not-configured' };
      }

      const source = config.source === 'event' ? context.event.payload : context.input;
      const raw = toStored(config.property?.trim()
        ? getValueAtPath(source, parsePath(config.property))
        : source);

      if (!isPlainObject(raw)) {
        return { success: false, message: '@core.automation/step.upsert.invalid-source' };
      }

      const { id, ...data } = raw;

      const spec: UpsertSpec = { table: config.table, data };
      if (id !== undefined && id !== null && String(id).trim() !== '') {
        spec.id = String(id);
      }

      const outcome = await runWorkflowUpsert(spec, context, deps, { ignoreUnwritableFields: true });
      if (!outcome.ok) {
        return { success: false, message: outcome.error, messageParams: outcome.errorParams };
      }

      const { id: recordId, created, record } = outcome.value;
      return {
        success: true,
        message: created
          ? '@core.automation/step.upsert.inserted'
          : '@core.automation/step.upsert.updated',
        messageParams: { table: config.table },
        outputs: { id: recordId, created, record },
      };
    },
  }),
});
