import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';

import type { WorkflowResult } from '../../../domain/entities/WorkflowContext';
export const makeSetVariableStepDefinition = (): StepDefinition => ({
  ...coreStepMetadata('set-variable'),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      const name = String(inputs.name);
      const value = inputs.value;
      
      context.variables[name] = value;
      
      return { 
        success: true, 
        message: '@core.automation/step.set-variable.done',
        messageParams: { name, value: String(value) },
        outputs: {
          [name]: value,
        },
      };
    },
  }),
});
