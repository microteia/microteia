import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import { resolveMapping } from '../../../domain/engine/InputMapping';
import type { MapStepConfig } from '../../../domain/schema/mapSpec';

import type { WorkflowResult } from '../../../domain/entities/WorkflowContext';
export const makeMapStepDefinition = (): StepDefinition => ({
  ...coreStepMetadata('map'),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      const config = inputs.map as MapStepConfig | undefined;
      if (!config || typeof config !== 'object' || !Array.isArray(config.fields)) {
        return { success: false, message: '@core.automation/step.map.not-configured' };
      }

      const object: Record<string, unknown> = {};
      for (const field of config.fields) {
        if (!field?.name?.trim()) continue;
        object[field.name] = resolveMapping(field.value, context);
      }

      const name = config.name?.trim();
      if (name) {
        return {
          success: true,
          message: '@core.automation/step.map.built-named',
          messageParams: { name },
          outputs: { [name]: object },
        };
      }

      return {
        success: true,
        message: '@core.automation/step.map.built-fields',
        outputs: object,
      };
    },
  }),
});
